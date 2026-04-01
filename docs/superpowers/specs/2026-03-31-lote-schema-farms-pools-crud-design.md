# Lote Schema + Farms/Pools CRUD — Design Spec

**Date:** 2026-03-31
**Status:** Approved

---

## Context

CrocoTrack's database has the foundation (orgs, farms, pools, incubators, food types, auth) but zero operational data tables. The **lote** (batch) is the central trazabilidad unit the entire operational layer depends on — feeding, mortality, classification, transfers, sacrifice, cleaning, and incubation events all attach to a lote. Without it, nothing can be built.

This spec covers two deliverables that must be implemented in order:

1. **Lote schema** — new migration with two tables, one enum, one RLS helper function, and worker-aware policies
2. **Farms/Pools CRUD** — the first UI screens, adopting the existing plan in `docs/plans/2026-03-09-farms-crud.md`, extended to show active lote data on pool rows

---

## Part 1: Lote Schema

### New Tables

#### `lotes`

The batch entity. One row = one group of animals occupying a pool during a time window.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `pool_id` | `uuid` | `NOT NULL REFERENCES pools(id) ON DELETE RESTRICT` |
| `org_id` | `uuid` | `NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` |
| `farm_id` | `uuid` | `NOT NULL REFERENCES farms(id) ON DELETE CASCADE` |
| `status` | `lote_status` | `NOT NULL DEFAULT 'activo'` |
| `opened_at` | `timestamptz` | `NOT NULL DEFAULT NOW()` |
| `closed_at` | `timestamptz` | nullable |
| `created_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT NOW()` + moddatetime trigger |

**Key constraint**: Partial unique index `UNIQUE (pool_id) WHERE status = 'activo'` — database-enforced one-active-lote-per-pool rule.

**Indexes**: `pool_id`, `org_id`, `farm_id`, `status` — explicit on every FK and every column used in RLS policies.

**Design notes:**
- `ON DELETE RESTRICT` on `pool_id`: a pool cannot be hard-deleted while it has any lotes (active or historical). Soft-delete via `is_active = false` is unaffected.
- `ON DELETE SET NULL` on `created_by`: profile deletion doesn't cascade to the lote.
- `org_id` and `farm_id` are denormalized for RLS performance and query efficiency — avoids JOINs on hot paths.

#### `lote_size_compositions`

One row per size-in-inches per lote. Fully relational, queryable, and aggregatable.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `lote_id` | `uuid` | `NOT NULL REFERENCES lotes(id) ON DELETE CASCADE` |
| `size_inches` | `smallint` | `NOT NULL` |
| `animal_count` | `integer` | `NOT NULL CHECK (animal_count > 0)` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT NOW()` + moddatetime trigger |

**Constraint**: `UNIQUE (lote_id, size_inches)` — one row per size per lote.
**Index**: `lote_id`.

**Design notes:**
- `size_inches` is `smallint`, not an enum. Crocodile sizes vary continuously; a fixed enum would require migrations for new sizes.
- No `org_id` on this child table — tenant scope is inherited through the parent `lotes` row via `EXISTS` subqueries in RLS.

### New Enum

```sql
CREATE TYPE public.lote_status AS ENUM ('activo', 'cerrado');
```

### Worker RLS: `user_has_farm_access(p_farm_id uuid)`

A reusable `SECURITY DEFINER` + `STABLE` helper that will be used by all operational tables:

```sql
CREATE OR REPLACE FUNCTION public.user_has_farm_access(p_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.org_id = (SELECT f.org_id FROM public.farms f WHERE f.id = p_farm_id)
          AND (
              p.role = 'owner'
              OR EXISTS (
                  SELECT 1
                  FROM public.user_farm_assignments ufa
                  WHERE ufa.user_id = p.id AND ufa.farm_id = p_farm_id
              )
          )
    );
$$;
```

- Returns `true` for **owners** in the farm's org, and for **workers** with a `user_farm_assignments` row for that farm.
- `(SELECT auth.uid())` is wrapped in a subquery — per Supabase RLS performance best practices, this causes Postgres to evaluate it once per query, not once per row.
- `SET search_path = ''` follows the existing pattern in `get_user_org_id()` and `is_owner()`.

### RLS Policies

All function calls in policies are wrapped in `(SELECT ...)` per Supabase best practices:

**`lotes`:**

| Operation | Policy |
|---|---|
| SELECT | `org_id = (SELECT public.get_user_org_id())` |
| INSERT | `org_id = (SELECT public.get_user_org_id()) AND (SELECT public.user_has_farm_access(farm_id))` |
| UPDATE | `org_id = (SELECT public.get_user_org_id()) AND (SELECT public.user_has_farm_access(farm_id))` |
| DELETE | `org_id = (SELECT public.get_user_org_id()) AND (SELECT public.is_owner())` |

**`lote_size_compositions`:** All policies use an `EXISTS` subquery joining back to `lotes` for org + farm scoping, same pattern.

### ERD

```
organizations (1) ──────── (N) farms (1) ──────────── (N) pools
                                  │                          │
                     user_farm_assignments           (N) lotes (1)
                          │    │                          │
                       profiles │               lote_size_compositions
                                │
                          (determines access via
                           user_has_farm_access())
```

### Migration File

`supabase/migrations/00002_lotes.sql`

Full SQL (enum → tables → indexes → triggers → helper function → RLS policies), following the exact conventions of `00001_initial_schema.sql`.

> **Note:** Run via the Supabase SQL Editor (not `supabase db push`) due to IPv6 routing issues on this machine.

After applying the migration, regenerate types:
```bash
bunx supabase gen types typescript --project-id rjhkwdrquocbbdeknfwr > src/shared/types/database.types.ts
```

---

## Part 2: Dexie v2 Extension

File: `src/shared/lib/db.ts`

### New Interfaces

```typescript
export interface LocalLote extends SyncMeta {
  readonly id: string;
  readonly pool_id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly status: "activo" | "cerrado";
  readonly opened_at: string;
  readonly closed_at?: string;
  readonly created_by?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalLoteSizeComposition extends SyncMeta {
  readonly id: string;
  readonly lote_id: string;
  readonly size_inches: number;
  readonly animal_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}
```

### Version Upgrade

Add `.version(2).stores(...)` to the `CrocoTrackDB` constructor — additive only, existing version 1 stores are preserved by Dexie automatically:

```typescript
this.version(2).stores({
  lotes: "id, pool_id, farm_id, org_id, status, _sync_status",
  lote_size_compositions: "id, lote_id, _sync_status",
});
```

### Sync Engine

Add `"lotes"` and `"lote_size_compositions"` to `SYNCABLE_TABLES` in `src/shared/lib/sync.ts`.

---

## Part 3: Zod Schemas

New file: `src/shared/schemas/lote.schema.ts`

```typescript
// Status enum
loteStatusSchema = z.enum(["activo", "cerrado"])

// Size composition item — shared by create and update
sizeCompositionItemSchema = z.object({
  size_inches: z.number().int().min(1).max(120),  // Spanish error messages
  animal_count: z.number().int().positive(),
})

// Create lote — pool_id + compositions (farm_id/org_id are derived server-side)
createLoteSchema = z.object({
  pool_id: z.string().uuid(),
  compositions: z.array(sizeCompositionItemSchema).min(1),
})

// Update compositions — standalone operation
updateLoteCompositionsSchema = z.object({
  compositions: z.array(sizeCompositionItemSchema).min(1),
})

// Close lote — status transition only
closeLoteSchema = z.object({
  closed_at: z.string().datetime().optional(),  // defaults to NOW() in API layer
})
```

`farm_id` and `org_id` are not in `createLoteSchema` — they are derived from the pool's farm in the API layer to prevent client spoofing.

---

## Part 4: Farms/Pools CRUD

### Source Plan

Implement `docs/plans/2026-03-09-farms-crud.md` in full (11 tasks: shadcn components, API layers, TanStack Query hooks, modal forms, pages). No redesign — the plan is thorough and follows all existing codebase patterns.

### Extension: Lote Data on Pool Rows

The pool table on `FarmDetailPage` should display active lote info for each pool.

**Extended pool query** (`pools.api.ts`):

```typescript
supabase
  .from("pools")
  .select(`
    *,
    lotes (
      id, status, opened_at,
      lote_size_compositions ( size_inches, animal_count )
    )
  `)
  .eq("farm_id", farmId)
  .eq("is_active", true)
  .eq("lotes.status", "activo")
```

The `.eq("lotes.status", "activo")` filter applies to the embedded `lotes` array — Supabase PostgREST treats this as a filter on the nested relation, not a join condition on the outer query. All active pools are returned; `lotes` will be `[]` for pools with no active lote, or a single-element array when one exists. The implementation should treat `lotes[0]` as the active lote (or `undefined` if empty).

**Pool row additions:**

| Column | Source |
|---|---|
| Total animals | `sum(animal_count)` across all compositions of the active lote |
| Sizes | Comma-separated list e.g. `12", 14", 16"` |
| Status badge | "Con lote" (has active lote) vs "Vacía" (no active lote) |

**Pre-deletion guard**: Before soft-deleting a pool (`is_active = false`), the API layer should check for an active lote and return an error: `"Esta pileta tiene un lote activo. Cierre el lote antes de desactivar la pileta."` The `ON DELETE RESTRICT` FK constraint is the DB-level backstop.

---

## Part 5: Future Operational Modules

This design deliberately stops at the lote. Every future operational table (feedings, mortalities, classifications, etc.) will follow this pattern:

- FK to `lotes(id)` + denormalized `org_id` + `farm_id`
- RLS: SELECT by org, INSERT/UPDATE by `user_has_farm_access(farm_id)`, DELETE by `is_owner()`
- Same Dexie/sync/Zod layering

The `user_has_farm_access()` function is reusable across all of them.

---

## Verification

```bash
# 1. Apply migration via Supabase SQL Editor (copy-paste 00002_lotes.sql)

# 2. Regenerate types
bunx supabase gen types typescript --project-id rjhkwdrquocbbdeknfwr > src/shared/types/database.types.ts

# 3. Verify new types exist
grep -E "lote_status|lotes|lote_size" src/shared/types/database.types.ts

# 4. Run typecheck
bun run typecheck

# 5. Run lint
bun run lint

# 6. Run tests
bun run test:run
```

Manual verification:
- Create a farm → create pools → verify they show "Vacía" on the detail page
- Apply the migration and confirm `lotes` and `lote_size_compositions` tables exist in Supabase dashboard
- Confirm the partial unique index prevents a second active lote on the same pool
