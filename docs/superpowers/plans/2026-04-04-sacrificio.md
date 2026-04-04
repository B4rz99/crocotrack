# Sacrificio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Sacrificio (slaughter) module — register slaughter events where all animals in a pool are measured, classified as sacrificed (removed from inventory) or rejected (transferred to destination pools), with explicit tracking of missing animals.

**Architecture:** Single RPC transaction handles all inventory mutations (close origin lote, remove sacrificed, transfer rejected). Frontend form uses a custom group editor where each measured size has sacrificed count + expandable rejected rows with per-row destination pools. Follows the exact clasificación/traslado pattern: event table + size_groups table with discriminator, Dexie offline cache, outbox sync.

**Tech Stack:** PostgreSQL (Supabase), React 19, TypeScript, Zod v4, TanStack Query, Zustand, Dexie.js, shadcn/ui (base-nova), Tailwind CSS v4, Biome, lucide-react.

**Design spec:** `docs/superpowers/specs/2026-04-04-sacrificio-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/00011_sacrificio.sql` | Tables, indexes, RLS, RPC |
| `src/shared/schemas/sacrificio.schema.ts` | Zod validation schema |
| `src/features/sacrificios/api/sacrificios.api.ts` | Supabase queries + RPC call + Dexie cache |
| `src/features/sacrificios/hooks/useCreateSacrificio.ts` | TanStack mutation hook |
| `src/features/sacrificios/hooks/useSacrificios.ts` | TanStack query hook |
| `src/features/sacrificios/hooks/useSacrificioDetail.ts` | TanStack detail query hook |
| `src/features/sacrificios/components/SacrificioGroupEditor.tsx` | Dynamic group editor (talla + sacrificados + rechazados) |
| `src/features/sacrificios/components/SacrificioForm.tsx` | Full form with pool selector + groups + summary |
| `src/features/sacrificios/components/SacrificioDetail.tsx` | Read-only detail view component |
| `src/features/sacrificios/pages/SacrificioListPage.tsx` | List page |
| `src/features/sacrificios/pages/CreateSacrificioPage.tsx` | Create page |
| `src/features/sacrificios/pages/SacrificioDetailPage.tsx` | Detail page |

### Modified files

| File | Change |
|------|--------|
| `src/shared/lib/db.ts` | Add `LocalSacrificio`, `LocalSacrificioSizeGroup` interfaces + Dexie version 8 stores |
| `src/shared/lib/sync.ts` | Add `"sacrificios"` and `"sacrificio_size_groups"` to `SYNCABLE_TABLES` |
| `src/shared/constants/routes.ts` | Add `SACRIFICIOS`, `SACRIFICIO_CREATE`, `SACRIFICIO_DETAIL` |
| `src/app/router.tsx` | Import pages + add children routes |
| `src/app/layouts/FarmLayout.tsx` | Add "Sacrificios" NavLink to sidebar |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00011_sacrificio.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================
-- Migration 00011: sacrificio
-- Creates sacrificios + sacrificio_size_groups,
-- RLS policies, and create_sacrificio() RPC.
-- ============================================

-- ============================================
-- SACRIFICIOS
-- ============================================
CREATE TABLE public.sacrificios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id          UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id          UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id          UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    event_date       DATE NOT NULL,
    total_animals    INTEGER NOT NULL CHECK (total_animals > 0),
    total_sacrificed INTEGER NOT NULL CHECK (total_sacrificed >= 0),
    total_rejected   INTEGER NOT NULL CHECK (total_rejected >= 0),
    total_faltantes  INTEGER NOT NULL DEFAULT 0 CHECK (total_faltantes >= 0),
    notes            TEXT,
    created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sacrificios_org_id      ON public.sacrificios(org_id);
CREATE INDEX idx_sacrificios_farm_id     ON public.sacrificios(farm_id);
CREATE INDEX idx_sacrificios_pool_id     ON public.sacrificios(pool_id);
CREATE INDEX idx_sacrificios_lote_id     ON public.sacrificios(lote_id);
CREATE INDEX idx_sacrificios_created_by  ON public.sacrificios(created_by);
CREATE INDEX idx_sacrificios_event_date  ON public.sacrificios(event_date DESC);
CREATE INDEX idx_sacrificios_active
    ON public.sacrificios(farm_id, event_date DESC)
    WHERE is_active = true;

CREATE TRIGGER sacrificios_updated_at
    BEFORE UPDATE ON public.sacrificios
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- SACRIFICIO SIZE GROUPS
-- ============================================
CREATE TABLE public.sacrificio_size_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacrificio_id        UUID NOT NULL REFERENCES public.sacrificios(id) ON DELETE CASCADE,
    group_type           TEXT NOT NULL CHECK (group_type IN ('sacrificado', 'rechazado')),
    size_inches          SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count         INTEGER NOT NULL CHECK (animal_count > 0),
    destination_pool_id  UUID REFERENCES public.pools(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (group_type = 'sacrificado' AND destination_pool_id IS NULL) OR
        (group_type = 'rechazado' AND destination_pool_id IS NOT NULL)
    )
);

CREATE INDEX idx_sacrificio_size_groups_sacrificio_id
    ON public.sacrificio_size_groups(sacrificio_id);
CREATE INDEX idx_sacrificio_size_groups_destination_pool_id
    ON public.sacrificio_size_groups(destination_pool_id);

CREATE TRIGGER sacrificio_size_groups_updated_at
    BEFORE UPDATE ON public.sacrificio_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS — sacrificios
-- ============================================
ALTER TABLE public.sacrificios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sacrificios FORCE ROW LEVEL SECURITY;

CREATE POLICY "sacrificios_select" ON public.sacrificios FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.get_user_org_id()));

CREATE POLICY "sacrificios_insert" ON public.sacrificios FOR INSERT
    TO authenticated
    WITH CHECK (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "sacrificios_update" ON public.sacrificios FOR UPDATE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.user_has_farm_access(farm_id))
    );

CREATE POLICY "sacrificios_delete" ON public.sacrificios FOR DELETE
    TO authenticated
    USING (
        org_id = (SELECT public.get_user_org_id())
        AND (SELECT public.is_owner())
    );

-- ============================================
-- RLS — sacrificio_size_groups
-- ============================================
ALTER TABLE public.sacrificio_size_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sacrificio_size_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY "sacrificio_size_select" ON public.sacrificio_size_groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
        )
    );

CREATE POLICY "sacrificio_size_insert" ON public.sacrificio_size_groups FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(s.farm_id))
        )
    );

CREATE POLICY "sacrificio_size_update" ON public.sacrificio_size_groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.user_has_farm_access(s.farm_id))
        )
    );

CREATE POLICY "sacrificio_size_delete" ON public.sacrificio_size_groups FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sacrificios s
            WHERE s.id = sacrificio_id
              AND s.org_id = (SELECT public.get_user_org_id())
              AND (SELECT public.is_owner())
        )
    );

-- ============================================
-- RPC: create_sacrificio()
-- ============================================
CREATE OR REPLACE FUNCTION public.create_sacrificio(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_event_date    DATE,
    p_sacrificed    JSONB,
    p_rejected      JSONB,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_caller_org_id     UUID;
    v_origin_lote_id    UUID;
    v_lote_total        INTEGER;
    v_total_sacrificed  INTEGER;
    v_total_rejected    INTEGER;
    v_total_faltantes   INTEGER;
    v_all_pool_ids      UUID[];
    v_dest_pool_id      UUID;
    v_dest_lote_id      UUID;
    v_size              SMALLINT;
    v_count             INTEGER;
    v_new_lote_id       UUID;
BEGIN
    -- 1. Resolve caller org (do NOT trust p_org_id)
    v_caller_org_id := public.get_user_org_id();
    IF v_caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la organizacion del usuario';
    END IF;

    -- 2. Guard: origin pool must belong to caller org AND be crianza
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id
          AND org_id = v_caller_org_id
          AND pool_type = 'crianza'
    ) THEN
        RAISE EXCEPTION 'La pileta no pertenece a su organizacion o no es una pileta de crianza';
    END IF;

    -- 2b. Guard: p_farm_id must match origin pool's farm
    IF NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = p_pool_id AND farm_id = p_farm_id
    ) THEN
        RAISE EXCEPTION 'La finca indicada no corresponde a la pileta de origen';
    END IF;

    -- 3. Calculate totals
    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_sacrificed
    FROM jsonb_array_elements(p_sacrificed) AS item;

    SELECT COALESCE(SUM((item->>'animal_count')::INTEGER), 0)
    INTO v_total_rejected
    FROM jsonb_array_elements(p_rejected) AS item;

    IF v_total_sacrificed + v_total_rejected <= 0 THEN
        RAISE EXCEPTION 'Debe registrar al menos un animal sacrificado o rechazado';
    END IF;

    -- 4. Collect all unique destination pool IDs (origin + rejected destinations)
    SELECT ARRAY(
        SELECT DISTINCT unnest(
            ARRAY[p_pool_id] ||
            ARRAY(
                SELECT DISTINCT (item->>'destination_pool_id')::UUID
                FROM jsonb_array_elements(p_rejected) AS item
                WHERE item->>'destination_pool_id' IS NOT NULL
            )
        )
    ) INTO v_all_pool_ids;

    -- 4b. Guard: all destination pools must belong to caller's org, be crianza, same farm
    IF EXISTS (
        SELECT 1 FROM public.pools
        WHERE id = ANY(v_all_pool_ids)
          AND (org_id != v_caller_org_id OR pool_type != 'crianza' OR farm_id != p_farm_id)
    ) THEN
        RAISE EXCEPTION 'Una o mas piletas de destino no son validas (deben pertenecer a la misma organizacion, finca, y ser de crianza)';
    END IF;

    -- 5. Create destination lotes if needed (before locking)
    FOR v_dest_pool_id IN
        SELECT DISTINCT (item->>'destination_pool_id')::UUID
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE item->>'destination_pool_id' IS NOT NULL
          AND (item->>'destination_pool_id')::UUID != p_pool_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.lotes
            WHERE pool_id = v_dest_pool_id AND status = 'activo'
        ) THEN
            v_new_lote_id := gen_random_uuid();
            INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
            SELECT v_new_lote_id, v_dest_pool_id, v_caller_org_id, farm_id, 'activo', NOW(), auth.uid()
            FROM public.pools WHERE id = v_dest_pool_id;
        END IF;
    END LOOP;

    -- 6. Deadlock prevention: lock ALL affected lotes in id-sorted order
    PERFORM id FROM public.lotes
    WHERE pool_id = ANY(v_all_pool_ids) AND status = 'activo'
    ORDER BY id
    FOR UPDATE;

    -- 7. Validate origin lote exists (after lock — race-safe)
    SELECT id INTO v_origin_lote_id
    FROM public.lotes
    WHERE pool_id = p_pool_id AND status = 'activo';

    IF v_origin_lote_id IS NULL THEN
        RAISE EXCEPTION 'La pileta de origen no tiene un lote activo';
    END IF;

    -- 8. Get total animals in origin lote
    SELECT COALESCE(SUM(animal_count), 0) INTO v_lote_total
    FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- 9. Validate: processed <= lote total
    IF v_total_sacrificed + v_total_rejected > v_lote_total THEN
        RAISE EXCEPTION 'El total procesado (% + %) excede el inventario del lote (%)',
            v_total_sacrificed, v_total_rejected, v_lote_total;
    END IF;

    -- 10. Calculate faltantes
    v_total_faltantes := v_lote_total - (v_total_sacrificed + v_total_rejected);

    -- 11. Insert sacrificio record
    INSERT INTO public.sacrificios (
        id, org_id, farm_id, pool_id, lote_id, event_date,
        total_animals, total_sacrificed, total_rejected, total_faltantes,
        notes, created_by, is_active
    ) VALUES (
        p_id, v_caller_org_id, p_farm_id, p_pool_id, v_origin_lote_id, p_event_date,
        v_lote_total, v_total_sacrificed, v_total_rejected, v_total_faltantes,
        p_notes, auth.uid(), true
    );

    -- 12. Insert sacrificio_size_groups — sacrificados
    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'sacrificado',
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER,
        NULL
    FROM jsonb_array_elements(p_sacrificed) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    -- 13. Insert sacrificio_size_groups — rechazados
    INSERT INTO public.sacrificio_size_groups (
        sacrificio_id, group_type, size_inches, animal_count, destination_pool_id
    )
    SELECT
        p_id,
        'rechazado',
        (item->>'size_inches')::SMALLINT,
        (item->>'animal_count')::INTEGER,
        (item->>'destination_pool_id')::UUID
    FROM jsonb_array_elements(p_rejected) AS item
    WHERE (item->>'animal_count')::INTEGER > 0;

    -- 14. Delete ALL lote_size_compositions for origin lote
    DELETE FROM public.lote_size_compositions
    WHERE lote_id = v_origin_lote_id;

    -- 15. Close origin lote unconditionally
    UPDATE public.lotes
    SET status = 'cerrado', closed_at = NOW(), updated_at = NOW()
    WHERE id = v_origin_lote_id;

    -- 16. If origin pool is also a destination for rejected: create NEW active lote
    IF p_pool_id = ANY(
        ARRAY(
            SELECT DISTINCT (item->>'destination_pool_id')::UUID
            FROM jsonb_array_elements(p_rejected) AS item
            WHERE item->>'destination_pool_id' IS NOT NULL
        )
    ) THEN
        v_new_lote_id := gen_random_uuid();
        INSERT INTO public.lotes (id, pool_id, org_id, farm_id, status, opened_at, created_by)
        SELECT v_new_lote_id, p_pool_id, v_caller_org_id, farm_id, 'activo', NOW(), auth.uid()
        FROM public.pools WHERE id = p_pool_id;
    END IF;

    -- 17. Upsert lote_size_compositions for each rejected destination pool
    FOR v_dest_pool_id, v_size, v_count IN
        SELECT
            (item->>'destination_pool_id')::UUID,
            (item->>'size_inches')::SMALLINT,
            SUM((item->>'animal_count')::INTEGER)
        FROM jsonb_array_elements(p_rejected) AS item
        WHERE (item->>'animal_count')::INTEGER > 0
        GROUP BY (item->>'destination_pool_id')::UUID, (item->>'size_inches')::SMALLINT
    LOOP
        SELECT id INTO v_dest_lote_id
        FROM public.lotes
        WHERE pool_id = v_dest_pool_id AND status = 'activo';

        INSERT INTO public.lote_size_compositions (lote_id, size_inches, animal_count)
        VALUES (v_dest_lote_id, v_size, v_count)
        ON CONFLICT (lote_id, size_inches)
        DO UPDATE SET
            animal_count = lote_size_compositions.animal_count + EXCLUDED.animal_count,
            updated_at = NOW();
    END LOOP;

    RETURN p_id;
END;
$$;
```

- [ ] **Step 2: Apply migration to Supabase**

Run the SQL in the Supabase SQL Editor (dashboard) since `supabase db push` fails due to IPv6 issues. Copy the full contents of `supabase/migrations/00011_sacrificio.sql` and execute.

Expected: All statements succeed, tables `sacrificios` and `sacrificio_size_groups` are created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00011_sacrificio.sql
git commit -m "feat(db): add sacrificio tables, RLS, and RPC"
```

---

## Task 2: Dexie Local DB + Sync

**Files:**
- Modify: `src/shared/lib/db.ts`
- Modify: `src/shared/lib/sync.ts`

- [ ] **Step 1: Add LocalSacrificio and LocalSacrificioSizeGroup interfaces to db.ts**

Add after the `LocalTrasladoSizeGroup` interface (before the `SyncOutboxEntry` interface):

```typescript
export interface LocalSacrificio extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly total_sacrificed: number;
  readonly total_rejected: number;
  readonly total_faltantes: number;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalSacrificioSizeGroup extends SyncMeta {
  readonly id: string;
  readonly sacrificio_id: string;
  readonly group_type: "sacrificado" | "rechazado";
  readonly size_inches: number;
  readonly animal_count: number;
  readonly destination_pool_id?: string;
  readonly created_at: string;
  readonly updated_at: string;
}
```

- [ ] **Step 2: Add Dexie table declarations and version 8 to the CrocoTrackDb class**

Add table declarations after `traslado_size_groups!`:

```typescript
sacrificios!: Table<LocalSacrificio>;
sacrificio_size_groups!: Table<LocalSacrificioSizeGroup>;
```

Add version 8 after the version 7 block inside the constructor:

```typescript
this.version(8).stores({
  sacrificios: "id, org_id, farm_id, pool_id, lote_id, event_date, _sync_status",
  sacrificio_size_groups: "id, sacrificio_id, _sync_status",
});
```

- [ ] **Step 3: Add tables to SYNCABLE_TABLES in sync.ts**

Add `"sacrificios"` and `"sacrificio_size_groups"` to the `SYNCABLE_TABLES` array, after `"traslado_size_groups"`:

```typescript
const SYNCABLE_TABLES = [
  // ... existing entries ...
  "traslados",
  "traslado_size_groups",
  "sacrificios",
  "sacrificio_size_groups",
] as const;
```

- [ ] **Step 4: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/db.ts src/shared/lib/sync.ts
git commit -m "feat(offline): add sacrificio tables to Dexie and sync"
```

---

## Task 3: Zod Schema

**Files:**
- Create: `src/shared/schemas/sacrificio.schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { z } from "zod";

const notFutureDate = (val: string) => val <= new Date().toLocaleDateString("en-CA");

export const rejectedGroupSchema = z.object({
  animal_count: z.number().int().positive("La cantidad debe ser mayor a 0"),
  destination_pool_id: z.string().uuid("Debe seleccionar una pileta destino"),
});

export const sacrificioGroupSchema = z
  .object({
    size_inches: z
      .number()
      .int("La talla debe ser un número entero")
      .positive("La talla debe ser mayor a 0"),
    sacrificed_count: z.number().int("Debe ser un número entero").min(0, "No puede ser negativo"),
    rejected: z.array(rejectedGroupSchema).default([]),
  })
  .refine(
    (g) => g.sacrificed_count + g.rejected.reduce((sum, r) => sum + r.animal_count, 0) > 0,
    { message: "Cada grupo debe tener al menos un animal", path: ["sacrificed_count"] }
  )
  .refine(
    (g) => {
      const destIds = g.rejected.map((r) => r.destination_pool_id);
      return destIds.length === new Set(destIds).size;
    },
    { message: "No puede haber destinos duplicados en el mismo grupo", path: ["rejected"] }
  );

export const createSacrificioSchema = z
  .object({
    pool_id: z.string().uuid("Debe seleccionar una pileta de origen"),
    event_date: z
      .string()
      .date("Formato de fecha inválido")
      .refine(notFutureDate, "La fecha no puede ser futura"),
    groups: z.array(sacrificioGroupSchema).min(1, "Debe agregar al menos un grupo de talla"),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      const sizes = data.groups.map((g) => g.size_inches);
      return sizes.length === new Set(sizes).size;
    },
    { message: "No puede haber tallas duplicadas", path: ["groups"] }
  );

export type RejectedGroupInput = z.infer<typeof rejectedGroupSchema>;
export type SacrificioGroupInput = z.infer<typeof sacrificioGroupSchema>;
export type CreateSacrificioInput = z.infer<typeof createSacrificioSchema>;
```

- [ ] **Step 2: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas/sacrificio.schema.ts
git commit -m "feat(schema): add Zod validation schema for sacrificio"
```

---

## Task 4: API Layer

**Files:**
- Create: `src/features/sacrificios/api/sacrificios.api.ts`

- [ ] **Step 1: Create the API file**

```typescript
import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateSacrificioInput } from "@/shared/schemas/sacrificio.schema";

interface SacrificioSizeGroup {
  readonly group_type: "sacrificado" | "rechazado";
  readonly size_inches: number;
  readonly animal_count: number;
  readonly destination_pool_id: string | null;
}

export interface SacrificioWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly total_sacrificed: number;
  readonly total_rejected: number;
  readonly total_faltantes: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly sacrificio_size_groups: readonly SacrificioSizeGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getSacrificiosByFarm(
  farmId: string
): Promise<SacrificioWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("sacrificios")
    .select(
      `
      *,
      sacrificio_size_groups ( group_type, size_inches, animal_count, destination_pool_id ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: SacrificioWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.sacrificios
      .where("farm_id")
      .equals(farmId)
      .filter((s) => s.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((s) => ({
      ...s,
      notes: s.notes ?? null,
      created_by: s.created_by ?? null,
      sacrificio_size_groups: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.sacrificios.bulkPut(
    data.map(
      ({ sacrificio_size_groups: _sg, profiles: _p, pools: _pools, ...sacrificio }) => ({
        ...sacrificio,
        notes: sacrificio.notes ?? undefined,
        created_by: sacrificio.created_by ?? undefined,
        _sync_status: "synced" as const,
        _local_updated_at: now,
      })
    )
  );

  return data;
}

export async function getSacrificioById(
  id: string
): Promise<SacrificioWithDetails | null> {
  const { data, error } = (await untypedSupabase
    .from("sacrificios")
    .select(
      `
      *,
      sacrificio_size_groups ( group_type, size_inches, animal_count, destination_pool_id ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("id", id)
    .single()) as {
    data: SacrificioWithDetails | null;
    error: { message: string } | null;
  };

  if (error || !data) return null;
  return data;
}

export async function createSacrificio(
  orgId: string,
  farmId: string,
  input: CreateSacrificioInput,
  loteId: string,
  loteTotal: number
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const pSacrificed = input.groups
    .filter((g) => g.sacrificed_count > 0)
    .map((g) => ({ size_inches: g.size_inches, animal_count: g.sacrificed_count }));

  const pRejected = input.groups.flatMap((g) =>
    g.rejected.map((r) => ({
      size_inches: g.size_inches,
      animal_count: r.animal_count,
      destination_pool_id: r.destination_pool_id,
    }))
  );

  const totalSacrificed = pSacrificed.reduce((sum, s) => sum + s.animal_count, 0);
  const totalRejected = pRejected.reduce((sum, r) => sum + r.animal_count, 0);
  const totalFaltantes = loteTotal - (totalSacrificed + totalRejected);

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_event_date: input.event_date,
    p_sacrificed: pSacrificed,
    p_rejected: pRejected,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_sacrificio", rpcPayload);

  const localSacrificio = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    lote_id: loteId,
    event_date: input.event_date,
    total_animals: loteTotal,
    total_sacrificed: totalSacrificed,
    total_rejected: totalRejected,
    total_faltantes: totalFaltantes,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.sacrificios.put(localSacrificio);

  if (error) {
    await addToOutbox("create_sacrificio", id, "RPC", {
      ...rpcPayload,
      _entity_table: "sacrificios",
    });
  }

  return { id };
}
```

- [ ] **Step 2: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sacrificios/api/sacrificios.api.ts
git commit -m "feat(api): add sacrificio API with RPC call and Dexie cache"
```

---

## Task 5: TanStack Query Hooks

**Files:**
- Create: `src/features/sacrificios/hooks/useCreateSacrificio.ts`
- Create: `src/features/sacrificios/hooks/useSacrificios.ts`
- Create: `src/features/sacrificios/hooks/useSacrificioDetail.ts`

- [ ] **Step 1: Create the mutation hook**

File: `src/features/sacrificios/hooks/useCreateSacrificio.ts`

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateSacrificioInput } from "@/shared/schemas/sacrificio.schema";
import { createSacrificio } from "../api/sacrificios.api";

interface CreateSacrificioArgs {
  readonly input: CreateSacrificioInput;
  readonly loteId: string;
  readonly loteTotal: number;
}

export function useCreateSacrificio(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, loteId, loteTotal }: CreateSacrificioArgs) => {
      if (!orgId) throw new Error("No org_id disponible");
      return createSacrificio(orgId, farmId, input, loteId, loteTotal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sacrificios", farmId] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
```

- [ ] **Step 2: Create the list query hook**

File: `src/features/sacrificios/hooks/useSacrificios.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getSacrificiosByFarm } from "../api/sacrificios.api";

export function useSacrificios(farmId: string) {
  return useQuery({
    queryKey: ["sacrificios", farmId],
    queryFn: () => getSacrificiosByFarm(farmId),
    enabled: !!farmId,
  });
}
```

- [ ] **Step 3: Create the detail query hook**

File: `src/features/sacrificios/hooks/useSacrificioDetail.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getSacrificioById } from "../api/sacrificios.api";

export function useSacrificioDetail(id: string) {
  return useQuery({
    queryKey: ["sacrificio", id],
    queryFn: () => getSacrificioById(id),
    enabled: !!id,
  });
}
```

- [ ] **Step 4: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/sacrificios/hooks/
git commit -m "feat(hooks): add TanStack Query hooks for sacrificio"
```

---

## Task 6: Zod Schema + Routes + Navigation

**Files:**
- Modify: `src/shared/constants/routes.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/FarmLayout.tsx`

- [ ] **Step 1: Add route constants**

In `src/shared/constants/routes.ts`, add after `TRASLADO_CREATE`:

```typescript
SACRIFICIOS: "/farms/:farmId/sacrificios",
SACRIFICIO_CREATE: "/farms/:farmId/sacrificios/nuevo",
SACRIFICIO_DETAIL: "/farms/:farmId/sacrificios/:sacrificioId",
```

- [ ] **Step 2: Add routes to router.tsx**

Add imports at the top of `src/app/router.tsx`:

```typescript
import { CreateSacrificioPage } from "@/features/sacrificios/pages/CreateSacrificioPage";
import { SacrificioDetailPage } from "@/features/sacrificios/pages/SacrificioDetailPage";
import { SacrificioListPage } from "@/features/sacrificios/pages/SacrificioListPage";
```

Add children after the `traslados/nuevo` route inside the `FARM_DASHBOARD` children array:

```typescript
{ path: "sacrificios", element: <SacrificioListPage /> },
{ path: "sacrificios/nuevo", element: <CreateSacrificioPage /> },
{ path: "sacrificios/:sacrificioId", element: <SacrificioDetailPage /> },
```

- [ ] **Step 3: Add NavLink to FarmLayout sidebar**

In `src/app/layouts/FarmLayout.tsx`, add the `Syringe` import from lucide-react (replace the existing import line to include it). Then add a NavLink after the Traslados NavLink:

```typescript
<NavLink to={ROUTES.SACRIFICIOS.replace(":farmId", farmId)} className={navLinkClass}>
  <SyringeIcon className="size-4" />
  Sacrificios
</NavLink>
```

Note: `SyringeIcon` is chosen because `Scissors` is already used for Clasificación. Import it from `lucide-react`. If `Syringe` is not available, use `Beef` or `Axe` instead.

- [ ] **Step 4: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: Will fail because page components don't exist yet. That's expected — the imports in router.tsx will resolve in the next task.

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/routes.ts src/app/router.tsx src/app/layouts/FarmLayout.tsx
git commit -m "feat(nav): add sacrificio routes and sidebar navigation"
```

---

## Task 7: Form Components

**Files:**
- Create: `src/features/sacrificios/components/SacrificioGroupEditor.tsx`
- Create: `src/features/sacrificios/components/SacrificioForm.tsx`

- [ ] **Step 1: Create SacrificioGroupEditor**

This is the most complex component. Each row has: talla input + sacrificados input + expandable rejected sub-rows (quantity + pool destination). A summary panel at the bottom shows totals.

File: `src/features/sacrificios/components/SacrificioGroupEditor.tsx`

```typescript
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { SacrificioGroupInput } from "@/shared/schemas/sacrificio.schema";

interface SacrificioGroupEditorProps {
  readonly loteTotal: number;
  readonly destinationPools: readonly PoolWithLotes[];
  readonly onChange: (groups: readonly SacrificioGroupInput[]) => void;
  readonly errors?: Record<string, string>;
  readonly groupErrors?: Record<number, Record<string, string>>;
}

type DraftRejected = {
  animal_count: string;
  destination_pool_id: string;
};

type DraftGroup = {
  size_inches: string;
  sacrificed_count: string;
  rejected: DraftRejected[];
  expanded: boolean;
};

function emptyGroup(): DraftGroup {
  return { size_inches: "", sacrificed_count: "", rejected: [], expanded: false };
}

function emptyRejected(): DraftRejected {
  return { animal_count: "", destination_pool_id: "" };
}

function toGroupInputs(drafts: readonly DraftGroup[]): readonly SacrificioGroupInput[] {
  return drafts.flatMap((d) => {
    const size = Number.parseInt(d.size_inches, 10);
    const sacrificed = Number.parseInt(d.sacrificed_count, 10);
    if (Number.isNaN(size)) return [];
    const rejected = d.rejected.flatMap((r) => {
      const count = Number.parseInt(r.animal_count, 10);
      if (Number.isNaN(count) || count <= 0 || !r.destination_pool_id) return [];
      return [{ animal_count: count, destination_pool_id: r.destination_pool_id }];
    });
    return [{ size_inches: size, sacrificed_count: Number.isNaN(sacrificed) ? 0 : sacrificed, rejected }];
  });
}

function poolLabel(pool: PoolWithLotes): string {
  const total = pool.lotes[0]?.lote_size_compositions.reduce(
    (sum, c) => sum + c.animal_count,
    0
  );
  return total !== undefined ? `${pool.name} (${total})` : pool.name;
}

export function SacrificioGroupEditor({
  loteTotal,
  destinationPools,
  onChange,
  errors = {},
  groupErrors = {},
}: SacrificioGroupEditorProps) {
  const [drafts, setDrafts] = useState<readonly DraftGroup[]>([emptyGroup()]);

  const totalSacrificed = drafts.reduce((sum, d) => {
    const n = Number.parseInt(d.sacrificed_count, 10);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);

  const totalRejected = drafts.reduce(
    (sum, d) =>
      sum +
      d.rejected.reduce((rs, r) => {
        const n = Number.parseInt(r.animal_count, 10);
        return rs + (Number.isNaN(n) ? 0 : n);
      }, 0),
    0
  );

  const totalProcessed = totalSacrificed + totalRejected;
  const faltantes = loteTotal - totalProcessed;

  function commitDrafts(next: readonly DraftGroup[]) {
    setDrafts(next);
    onChange(toGroupInputs(next));
  }

  function updateDraft(index: number, patch: Partial<DraftGroup>) {
    commitDrafts(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addGroup() {
    commitDrafts([...drafts, emptyGroup()]);
  }

  function removeGroup(index: number) {
    if (drafts.length <= 1) return;
    commitDrafts(drafts.filter((_, i) => i !== index));
  }

  function toggleExpanded(index: number) {
    updateDraft(index, { expanded: !drafts[index]?.expanded });
  }

  function addRejected(groupIndex: number) {
    const group = drafts[groupIndex];
    if (!group) return;
    updateDraft(groupIndex, {
      rejected: [...group.rejected, emptyRejected()],
      expanded: true,
    });
  }

  function updateRejected(groupIndex: number, rejIndex: number, patch: Partial<DraftRejected>) {
    const group = drafts[groupIndex];
    if (!group) return;
    const newRejected = group.rejected.map((r, i) => (i === rejIndex ? { ...r, ...patch } : r));
    updateDraft(groupIndex, { rejected: newRejected });
  }

  function removeRejected(groupIndex: number, rejIndex: number) {
    const group = drafts[groupIndex];
    if (!group) return;
    updateDraft(groupIndex, {
      rejected: group.rejected.filter((_, i) => i !== rejIndex),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Grupos de talla medidos</Label>
      </div>

      {drafts.map((draft, index) => {
        const rowErrors = groupErrors[index] ?? {};
        const hasRejected = draft.rejected.length > 0;

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: draft list has no stable keys
          <div key={index} className="rounded-lg border bg-card p-3 space-y-3">
            <div className="flex gap-2 items-start">
              <div className="flex-none w-24 space-y-1">
                {index === 0 && (
                  <Label htmlFor={`size-${index}`} className="text-xs text-muted-foreground">
                    Talla (pulg.)
                  </Label>
                )}
                <Input
                  id={`size-${index}`}
                  type="number"
                  min={1}
                  placeholder="16"
                  value={draft.size_inches}
                  aria-invalid={!!rowErrors.size_inches}
                  onChange={(e) => updateDraft(index, { size_inches: e.target.value })}
                />
                <FieldError message={rowErrors.size_inches} />
              </div>

              <div className="flex-none w-28 space-y-1">
                {index === 0 && (
                  <Label htmlFor={`sacrificed-${index}`} className="text-xs text-muted-foreground">
                    Sacrificados
                  </Label>
                )}
                <Input
                  id={`sacrificed-${index}`}
                  type="number"
                  min={0}
                  placeholder="40"
                  value={draft.sacrificed_count}
                  aria-invalid={!!rowErrors.sacrificed_count}
                  onChange={(e) => updateDraft(index, { sacrificed_count: e.target.value })}
                />
                <FieldError message={rowErrors.sacrificed_count} />
              </div>

              <div className="flex-1 flex items-center gap-1">
                {index === 0 && (
                  <div className="h-5" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={index === 0 ? "mt-5" : ""}
                  onClick={() => hasRejected ? toggleExpanded(index) : addRejected(index)}
                >
                  {hasRejected ? (
                    <>
                      {draft.expanded ? <ChevronDownIcon className="mr-1 size-3" /> : <ChevronRightIcon className="mr-1 size-3" />}
                      Rechazados ({draft.rejected.length})
                    </>
                  ) : (
                    <>
                      <PlusIcon className="mr-1 size-3" />
                      Rechazados
                    </>
                  )}
                </Button>
              </div>

              <div className={index === 0 ? "mt-5" : ""}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar grupo"
                  disabled={drafts.length <= 1}
                  onClick={() => removeGroup(index)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>

            {draft.expanded && draft.rejected.length > 0 && (
              <div className="ml-4 space-y-2 border-l-2 border-muted pl-3">
                {draft.rejected.map((rej, rejIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: draft list has no stable keys
                  <div key={rejIndex} className="flex gap-2 items-start">
                    <div className="flex-none w-24 space-y-1">
                      {rejIndex === 0 && (
                        <span className="text-xs text-muted-foreground">Cantidad</span>
                      )}
                      <Input
                        type="number"
                        min={1}
                        placeholder="10"
                        value={rej.animal_count}
                        onChange={(e) => updateRejected(index, rejIndex, { animal_count: e.target.value })}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      {rejIndex === 0 && (
                        <span className="text-xs text-muted-foreground">Pileta destino</span>
                      )}
                      <Select
                        value={rej.destination_pool_id}
                        onValueChange={(val) => {
                          if (val) updateRejected(index, rejIndex, { destination_pool_id: val });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {() => {
                              const pool = destinationPools.find((p) => p.id === rej.destination_pool_id);
                              return pool ? poolLabel(pool) : "Seleccionar pileta";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {destinationPools.map((pool) => (
                            <SelectItem key={pool.id} value={pool.id}>
                              {poolLabel(pool)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={rejIndex === 0 ? "mt-5" : ""}
                      aria-label="Eliminar rechazo"
                      onClick={() => removeRejected(index, rejIndex)}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addRejected(index)}
                >
                  <PlusIcon className="mr-1 size-3" />
                  Agregar destino
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {errors.groups && <FieldError message={errors.groups} />}

      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
        <PlusIcon className="mr-1 size-4" />
        Agregar talla
      </Button>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span>Total sacrificados</span>
          <span className="font-medium">{totalSacrificed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total rechazados</span>
          <span className="font-medium">{totalRejected}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total procesados</span>
          <span className="font-medium">{totalProcessed} / {loteTotal}</span>
        </div>
        {faltantes > 0 && (
          <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400 font-medium">
            <span>Faltantes ⚠</span>
            <span>{faltantes}</span>
          </div>
        )}
        {totalProcessed > loteTotal && (
          <p className="text-sm text-destructive font-medium">
            El total procesado excede el inventario del lote
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SacrificioForm**

File: `src/features/sacrificios/components/SacrificioForm.tsx`

```typescript
import { type FormEvent, useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { zodArrayFieldErrors, zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import type {
  CreateSacrificioInput,
  SacrificioGroupInput,
} from "@/shared/schemas/sacrificio.schema";
import { createSacrificioSchema } from "@/shared/schemas/sacrificio.schema";
import { SacrificioGroupEditor } from "./SacrificioGroupEditor";

interface SacrificioFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: {
    input: CreateSacrificioInput;
    loteId: string;
    loteTotal: number;
  }) => void;
}

function poolOriginLabel(pool: PoolWithLotes): string {
  const total = pool.lotes[0]?.lote_size_compositions.reduce(
    (sum, c) => sum + c.animal_count,
    0
  );
  return total !== undefined ? `${pool.name} — ${total} animales` : pool.name;
}

export function SacrificioForm({ pools, isLoading = false, onSubmit }: SacrificioFormProps) {
  const [poolId, setPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [groups, setGroups] = useState<readonly SacrificioGroupInput[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [groupErrors, setGroupErrors] = useState<Record<number, Record<string, string>>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const crianzaPools = pools.filter((p) => p.pool_type === "crianza" && p.lotes.length > 0);
  const allCrianzaPools = pools.filter((p) => p.pool_type === "crianza");

  const selectedPool = crianzaPools.find((p) => p.id === poolId);
  const activeLoteId = selectedPool?.lotes[0]?.id ?? "";
  const loteTotal =
    selectedPool?.lotes[0]?.lote_size_compositions.reduce(
      (sum, c) => sum + c.animal_count,
      0
    ) ?? 0;

  function handlePoolChange(value: string | null) {
    if (!value) return;
    setPoolId(value);
    setGroups([]);
    setErrors({});
    setGroupErrors({});
    setShowConfirm(false);
  }

  function doSubmit() {
    const raw = {
      pool_id: poolId,
      event_date: eventDate,
      groups,
      notes: notes || undefined,
    };

    const result = createSacrificioSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      setGroupErrors(zodArrayFieldErrors(result.error, "groups"));
      return;
    }

    const totalProcessed =
      result.data.groups.reduce(
        (sum, g) => sum + g.sacrificed_count + g.rejected.reduce((rs, r) => rs + r.animal_count, 0),
        0
      );

    if (totalProcessed > loteTotal) {
      setErrors({ groups: "El total procesado excede el inventario del lote" });
      return;
    }

    const faltantes = loteTotal - totalProcessed;
    if (faltantes > 0 && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    onSubmit({ input: result.data, loteId: activeLoteId, loteTotal });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setGroupErrors({});
    doSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-date">Fecha del evento</Label>
        <Input
          id="event-date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          aria-invalid={!!errors.event_date}
        />
        <FieldError message={errors.event_date} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pool-select">Pileta de origen</Label>
        <Select value={poolId} onValueChange={handlePoolChange}>
          <SelectTrigger id="pool-select" className="w-full" aria-invalid={!!errors.pool_id}>
            <SelectValue>
              {() => {
                const pool = crianzaPools.find((p) => p.id === poolId);
                return pool ? poolOriginLabel(pool) : "Seleccionar pileta";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {crianzaPools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {poolOriginLabel(pool)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {crianzaPools.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay piletas de crianza con lote activo.
          </p>
        )}
        <FieldError message={errors.pool_id} />
      </div>

      {poolId && (
        <SacrificioGroupEditor
          key={poolId}
          loteTotal={loteTotal}
          destinationPools={allCrianzaPools}
          onChange={setGroups}
          errors={errors}
          groupErrors={groupErrors}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          placeholder="Observaciones adicionales..."
        />
      </div>

      {showConfirm && (
        <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Hay {loteTotal - groups.reduce(
              (sum, g) => sum + g.sacrificed_count + g.rejected.reduce((rs, r) => rs + r.animal_count, 0),
              0
            )} animales sin contabilizar. ¿Desea continuar?
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="default" size="sm">
              Sí, registrar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!showConfirm && (
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Registrando..." : "Registrar Sacrificio"}
        </Button>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/sacrificios/components/
git commit -m "feat(ui): add SacrificioForm and SacrificioGroupEditor components"
```

---

## Task 8: Pages

**Files:**
- Create: `src/features/sacrificios/pages/SacrificioListPage.tsx`
- Create: `src/features/sacrificios/pages/CreateSacrificioPage.tsx`
- Create: `src/features/sacrificios/pages/SacrificioDetailPage.tsx`
- Create: `src/features/sacrificios/components/SacrificioDetail.tsx`

- [ ] **Step 1: Create SacrificioListPage**

File: `src/features/sacrificios/pages/SacrificioListPage.tsx`

```typescript
import { PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { formatDateDisplay } from "@/shared/lib/utils";
import { useSacrificios } from "../hooks/useSacrificios";

export function SacrificioListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: sacrificios, isLoading, isError } = useSacrificios(farmId);

  const createPath = ROUTES.SACRIFICIO_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando sacrificios...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">Error al cargar los sacrificios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sacrificios</h1>
          <p className="text-sm text-muted-foreground">
            Registro de procesos de sacrificio por pileta
          </p>
        </div>
        <Link to={createPath}>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Nuevo Sacrificio
          </Button>
        </Link>
      </div>

      {sacrificios?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">Sin sacrificios registrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra el primer proceso de sacrificio.
          </p>
          <Link to={createPath}>
            <Button className="mt-4" variant="outline">
              Registrar Sacrificio
            </Button>
          </Link>
        </div>
      )}

      {sacrificios && sacrificios.length > 0 && (
        <div className="space-y-3">
          {sacrificios.map((sacrificio) => {
            const detailPath = ROUTES.SACRIFICIO_DETAIL
              .replace(":farmId", farmId)
              .replace(":sacrificioId", sacrificio.id);
            return (
              <Link key={sacrificio.id} to={detailPath} className="block">
                <div className="rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {sacrificio.pools?.name ?? "Pileta desconocida"}
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{sacrificio.total_sacrificed} sacrificados</span>
                        <span>{sacrificio.total_rejected} rechazados</span>
                        {sacrificio.total_faltantes > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {sacrificio.total_faltantes} faltantes ⚠
                          </span>
                        )}
                      </div>
                      {sacrificio.profiles?.full_name && (
                        <p className="text-xs text-muted-foreground">
                          Por: {sacrificio.profiles.full_name}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDateDisplay(sacrificio.event_date)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create CreateSacrificioPage**

File: `src/features/sacrificios/pages/CreateSacrificioPage.tsx`

```typescript
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { ROUTES } from "@/shared/constants/routes";
import { SacrificioForm } from "../components/SacrificioForm";
import { useCreateSacrificio } from "../hooks/useCreateSacrificio";

export function CreateSacrificioPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [], isLoading: poolsLoading, isError: poolsError } = usePools(farmId);
  const createSacrificio = useCreateSacrificio(farmId);

  const listPath = ROUTES.SACRIFICIOS.replace(":farmId", farmId);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo Sacrificio</h1>
        <p className="text-sm text-muted-foreground">
          Registra el proceso de sacrificio de una pileta
        </p>
      </div>
      {poolsError && <p className="text-sm text-destructive">Error al cargar piletas.</p>}
      {poolsLoading ? (
        <p className="text-sm text-muted-foreground">Cargando piletas...</p>
      ) : (
        <SacrificioForm
          pools={pools}
          isLoading={createSacrificio.isPending}
          onSubmit={({ input, loteId, loteTotal }) => {
            createSacrificio.mutate(
              { input, loteId, loteTotal },
              {
                onSuccess: () => {
                  toast.success("Sacrificio registrado");
                  navigate(listPath);
                },
                onError: (err) => {
                  toast.error(
                    err instanceof Error ? err.message : "Error al registrar sacrificio"
                  );
                },
              }
            );
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create SacrificioDetail component**

File: `src/features/sacrificios/components/SacrificioDetail.tsx`

```typescript
import type { SacrificioWithDetails } from "../api/sacrificios.api";
import { formatDateDisplay } from "@/shared/lib/utils";

interface SacrificioDetailProps {
  readonly sacrificio: SacrificioWithDetails;
  readonly poolNames?: ReadonlyMap<string, string>;
}

export function SacrificioDetail({ sacrificio, poolNames = new Map() }: SacrificioDetailProps) {
  const sacrificados = sacrificio.sacrificio_size_groups.filter(
    (g) => g.group_type === "sacrificado"
  );
  const rechazados = sacrificio.sacrificio_size_groups.filter(
    (g) => g.group_type === "rechazado"
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Pileta</p>
          <p className="font-medium">{sacrificio.pools?.name ?? "Desconocida"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fecha</p>
          <p className="font-medium">{formatDateDisplay(sacrificio.event_date)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Registrado por</p>
          <p className="font-medium">{sacrificio.profiles?.full_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total en lote</p>
          <p className="font-medium">{sacrificio.total_animals} animales</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{sacrificio.total_sacrificed}</p>
          <p className="text-sm text-muted-foreground">Sacrificados</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{sacrificio.total_rejected}</p>
          <p className="text-sm text-muted-foreground">Rechazados</p>
        </div>
        {sacrificio.total_faltantes > 0 && (
          <div className="rounded-lg border border-amber-500 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {sacrificio.total_faltantes}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">Faltantes</p>
          </div>
        )}
      </div>

      {sacrificados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Animales sacrificados</h3>
          <div className="flex flex-wrap gap-2">
            {sacrificados.map((g) => (
              <span
                key={`s-${g.size_inches}`}
                className="rounded-full bg-muted px-3 py-1 text-sm"
              >
                {g.size_inches}" — {g.animal_count}
              </span>
            ))}
          </div>
        </div>
      )}

      {rechazados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Animales rechazados</h3>
          <div className="space-y-2">
            {rechazados.map((g, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: read-only display list
                key={i}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  {g.size_inches}" — {g.animal_count} animales
                </span>
                <span className="text-muted-foreground">
                  → {(g.destination_pool_id && poolNames.get(g.destination_pool_id)) ?? "Pileta desconocida"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sacrificio.notes && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Notas</h3>
          <p className="text-sm text-muted-foreground">{sacrificio.notes}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create SacrificioDetailPage**

File: `src/features/sacrificios/pages/SacrificioDetailPage.tsx`

```typescript
import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { SacrificioDetail } from "../components/SacrificioDetail";
import { useSacrificioDetail } from "../hooks/useSacrificioDetail";

export function SacrificioDetailPage() {
  const { farmId = "", sacrificioId = "" } = useParams<{
    farmId: string;
    sacrificioId: string;
  }>();
  const { data: sacrificio, isLoading, isError } = useSacrificioDetail(sacrificioId);
  const { data: pools = [] } = usePools(farmId);

  const poolNames = useMemo(
    () => new Map(pools.map((p) => [p.id, p.name])),
    [pools]
  );

  const listPath = ROUTES.SACRIFICIOS.replace(":farmId", farmId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando detalle...</p>
      </div>
    );
  }

  if (isError || !sacrificio) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">No se encontró el sacrificio.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to={listPath}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Detalle de Sacrificio</h1>
          <p className="text-sm text-muted-foreground">Vista completa del evento</p>
        </div>
      </div>
      <SacrificioDetail sacrificio={sacrificio} poolNames={poolNames} />
    </div>
  );
}
```

- [ ] **Step 5: Verify the full app compiles**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Run linter**

Run: `bun run lint`
Expected: No new errors introduced.

- [ ] **Step 7: Commit**

```bash
git add src/features/sacrificios/
git commit -m "feat(sacrificio): add list, create, and detail pages"
```

---

## Task 9: Smoke Test & Final Verification

- [ ] **Step 1: Start the dev server**

Run: `bun run dev`
Expected: App starts without errors.

- [ ] **Step 2: Verify navigation**

Open the app in browser. Select a farm. Verify "Sacrificios" appears in the sidebar after "Traslados". Click it. Verify the empty state list page loads.

- [ ] **Step 3: Verify create form**

Click "Nuevo Sacrificio". Verify:
- Pool selector shows only crianza pools with active lotes
- Selecting a pool shows the lote total
- Group editor allows adding tallas with sacrificados/rechazados
- Summary panel updates in real time
- Submitting with faltantes shows confirmation dialog

- [ ] **Step 4: Verify detail page**

After creating a sacrificio, click on it in the list. Verify the detail page shows all data correctly.

- [ ] **Step 5: Run full type check and lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: All clean.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address smoke test issues in sacrificio module"
```
