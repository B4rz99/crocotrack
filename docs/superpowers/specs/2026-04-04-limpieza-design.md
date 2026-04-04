# Limpieza de Pileta — Design Spec

**Date:** 2026-04-04
**Status:** Draft
**MVP Section:** 10 — Limpieza de Pileta

---

## 1. Summary

Limpieza de Pileta registers the execution of pool cleanings and tracks consumption of cleaning products. Unlike other operational modules (mortalidad, clasificación, traslados), cleaning does **not** affect animal inventory — it operates independently of lotes and size compositions.

The system calculates whether a pool is overdue for cleaning based on a farm-level frequency setting (`cleaning_frequency_days`) and the date of each pool's last registered cleaning. No schedule records are materialized — overdue status is a derived calculation.

### Constraints decided during design

- **Both pool types** — applies to `crianza` and `reproductor` pools (unlike mortalidad which is crianza-only).
- **Frequency at farm level** — all pools in a farm share the same cleaning frequency (configurable by the owner).
- **Automatic scheduling** — no manual scheduling; the system auto-calculates next due date from `last_cleaning + frequency`.
- **Product catalog with stock** — cleaning products are a configurable catalog (like food types) with stock tracking, purchases, and consumption.
- **Quantity in integer units** — approximate, no specific unit of measurement. Workers apply products "al ojo."
- **Default products** — "Sulfato de Cobre", "Azul de Metileno", "Cal" are pre-loaded during onboarding.
- **Configuration in onboarding + settings** — products and frequency are set up during onboarding and editable in farm settings.

---

## 2. Database Schema

### 2.1 `cleaning_product_types` table (catalog)

Mirrors `food_types`. Organization-scoped catalog of cleaning products.

```sql
CREATE TABLE public.cleaning_product_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaning_product_types_org_id ON public.cleaning_product_types(org_id);

CREATE TRIGGER cleaning_product_types_updated_at
    BEFORE UPDATE ON public.cleaning_product_types
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

No `unit` column — quantity is always integer "units" (approximate).

### 2.2 `cleaning_product_stock` table

Mirrors `food_stock`. One record per product per farm.

```sql
CREATE TABLE public.cleaning_product_stock (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id                     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    current_quantity            INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold         INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, cleaning_product_type_id)
);

CREATE INDEX idx_cleaning_product_stock_org_id ON public.cleaning_product_stock(org_id);
CREATE INDEX idx_cleaning_product_stock_farm_id ON public.cleaning_product_stock(farm_id);
CREATE INDEX idx_cleaning_product_stock_type_id ON public.cleaning_product_stock(cleaning_product_type_id);

CREATE TRIGGER cleaning_product_stock_updated_at
    BEFORE UPDATE ON public.cleaning_product_stock
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

`UNIQUE(farm_id, cleaning_product_type_id)` enables the `ON CONFLICT` upsert in RPCs.

### 2.3 `cleaning_product_purchases` table

Mirrors `food_purchases`. Each purchase increments stock.

```sql
CREATE TABLE public.cleaning_product_purchases (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id                     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    purchase_date               DATE NOT NULL,
    quantity                    INTEGER NOT NULL CHECK (quantity > 0),
    supplier                   TEXT,
    notes                      TEXT,
    created_by                 UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active                  BOOLEAN NOT NULL DEFAULT true,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaning_purchases_org_id ON public.cleaning_product_purchases(org_id);
CREATE INDEX idx_cleaning_purchases_farm_id ON public.cleaning_product_purchases(farm_id);
CREATE INDEX idx_cleaning_purchases_type_id ON public.cleaning_product_purchases(cleaning_product_type_id);
CREATE INDEX idx_cleaning_purchases_created_by ON public.cleaning_product_purchases(created_by);
CREATE INDEX idx_cleaning_purchases_date ON public.cleaning_product_purchases(purchase_date DESC);
CREATE INDEX idx_cleaning_purchases_active
    ON public.cleaning_product_purchases(farm_id, purchase_date DESC)
    WHERE is_active = true;

CREATE TRIGGER cleaning_product_purchases_updated_at
    BEFORE UPDATE ON public.cleaning_product_purchases
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 2.4 `limpiezas` table

The cleaning execution event. No `lote_id` — cleaning does not affect animal inventory.

```sql
CREATE TABLE public.limpiezas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id         UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    event_date      DATE NOT NULL,
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_limpiezas_org_id ON public.limpiezas(org_id);
CREATE INDEX idx_limpiezas_farm_id ON public.limpiezas(farm_id);
CREATE INDEX idx_limpiezas_pool_id ON public.limpiezas(pool_id);
CREATE INDEX idx_limpiezas_created_by ON public.limpiezas(created_by);
CREATE INDEX idx_limpiezas_event_date ON public.limpiezas(event_date DESC);
CREATE INDEX idx_limpiezas_active
    ON public.limpiezas(farm_id, event_date DESC)
    WHERE is_active = true;
```

### 2.5 `limpieza_products` table

Child table of `limpiezas`. Products used in each cleaning. Each row triggers a stock decrement.

```sql
CREATE TABLE public.limpieza_products (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limpieza_id                 UUID NOT NULL REFERENCES public.limpiezas(id) ON DELETE CASCADE,
    cleaning_product_type_id    UUID NOT NULL REFERENCES public.cleaning_product_types(id) ON DELETE RESTRICT,
    quantity                    INTEGER NOT NULL CHECK (quantity > 0),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_limpieza_products_limpieza_id ON public.limpieza_products(limpieza_id);
CREATE INDEX idx_limpieza_products_type_id ON public.limpieza_products(cleaning_product_type_id);

CREATE TRIGGER limpieza_products_updated_at
    BEFORE UPDATE ON public.limpieza_products
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 2.6 `farms` table alteration

New column for cleaning frequency.

```sql
ALTER TABLE public.farms
    ADD COLUMN cleaning_frequency_days INTEGER CHECK (cleaning_frequency_days > 0);
```

`NULL` means no frequency configured (no alerts). Example values: `30` (monthly), `60` (bi-monthly), `90` (quarterly).

### 2.7 RLS Policies

**`cleaning_product_types`** — same pattern as `food_types`:

- **SELECT:** `org_id = (SELECT public.get_user_org_id())`
- **INSERT/UPDATE/DELETE:** org match + `(SELECT public.is_owner())`

**`cleaning_product_stock`** — same pattern as `food_stock`:

- **SELECT:** `org_id = (SELECT public.get_user_org_id())`
- **INSERT/UPDATE:** org match + `(SELECT public.user_has_farm_access(farm_id))`
- **DELETE:** org match + `(SELECT public.is_owner())`

**`cleaning_product_purchases`** — same pattern as `food_purchases`:

- **SELECT:** `org_id = (SELECT public.get_user_org_id())`
- **INSERT/UPDATE:** org match + `(SELECT public.user_has_farm_access(farm_id))`
- **DELETE:** org match + `(SELECT public.is_owner())`

**`limpiezas`** — same pattern as `mortalidades`:

- **SELECT:** `org_id = (SELECT public.get_user_org_id())`
- **INSERT/UPDATE:** org match + `(SELECT public.user_has_farm_access(farm_id))`
- **DELETE:** org match + `(SELECT public.is_owner())`

**`limpieza_products`** — delegates to parent via EXISTS (same as `mortalidad_size_groups`):

- **SELECT:** `EXISTS (SELECT 1 FROM public.limpiezas l WHERE l.id = limpieza_id AND l.org_id = (SELECT public.get_user_org_id()))`
- **INSERT/UPDATE:** EXISTS with org match + farm access
- **DELETE:** EXISTS with org match + is_owner

All function calls wrapped in `(SELECT ...)` for RLS performance optimization.

### 2.8 RPC: `create_limpieza()`

**Signature:**

```sql
CREATE OR REPLACE FUNCTION public.create_limpieza(
    p_id            UUID,
    p_org_id        UUID,
    p_farm_id       UUID,
    p_pool_id       UUID,
    p_event_date    DATE,
    p_products      JSONB,
    p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
```

`p_products` is a JSONB array: `[{"cleaning_product_type_id": "uuid", "quantity": 2}, ...]`

**Logic (plpgsql, SECURITY INVOKER, SET search_path = public):**

1. **Resolve caller org** — `get_user_org_id()`, do not trust `p_org_id`.
2. **Guard: pool** — must belong to caller's org and `farm_id = p_farm_id`. No pool_type filter (both crianza and reproductor allowed).
3. **Guard: products array** — must have at least one element. Must not contain duplicate `cleaning_product_type_id` values.
4. **Validate each product** — `cleaning_product_type_id` must belong to caller's org and be `is_active = true`. Quantity must be > 0.
5. **Insert `limpiezas` record.**
6. **Insert `limpieza_products`** — one row per product from `p_products`.
7. **Decrement `cleaning_product_stock`** — for each product, upsert with `ON CONFLICT (farm_id, cleaning_product_type_id) DO UPDATE SET current_quantity = current_quantity - quantity`. Allows negative stock (same behavior as `create_alimentacion`).
8. **Return `p_id`.**

### 2.9 RPC: `create_cleaning_product_purchase()`

**Signature:**

```sql
CREATE OR REPLACE FUNCTION public.create_cleaning_product_purchase(
    p_id                        UUID,
    p_org_id                    UUID,
    p_farm_id                   UUID,
    p_cleaning_product_type_id  UUID,
    p_purchase_date             DATE,
    p_quantity                  INTEGER,
    p_supplier                  TEXT DEFAULT NULL,
    p_notes                     TEXT DEFAULT NULL
)
RETURNS UUID
```

**Logic (plpgsql, SECURITY INVOKER, SET search_path = public):**

1. **Resolve caller org** — `get_user_org_id()`.
2. **Guard: farm** — must belong to caller's org.
3. **Guard: product type** — must belong to caller's org and be `is_active = true`.
4. **Guard: quantity > 0.**
5. **Insert `cleaning_product_purchases` record.**
6. **Upsert `cleaning_product_stock`** — increment `current_quantity` by `p_quantity`.
7. **Return `p_id`.**

---

## 3. Offline Layer (Dexie)

### 3.1 New interfaces in `db.ts`

```typescript
export interface LocalCleaningProductType extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalCleaningProductStock extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly cleaning_product_type_id: string;
  readonly current_quantity: number;
  readonly low_stock_threshold?: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalCleaningProductPurchase extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly cleaning_product_type_id: string;
  readonly purchase_date: string;
  readonly quantity: number;
  readonly supplier?: string;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalLimpieza extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly event_date: string;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalLimpiezaProduct extends SyncMeta {
  readonly id: string;
  readonly limpieza_id: string;
  readonly cleaning_product_type_id: string;
  readonly quantity: number;
  readonly created_at: string;
  readonly updated_at: string;
}
```

### 3.2 Dexie version bump

Add **version 8** to the `CrocoTrackDb` constructor:

```typescript
this.version(8).stores({
  cleaning_product_types: "id, org_id, _sync_status",
  cleaning_product_stock:
    "id, org_id, farm_id, cleaning_product_type_id, [farm_id+cleaning_product_type_id], _sync_status",
  cleaning_product_purchases:
    "id, org_id, farm_id, cleaning_product_type_id, purchase_date, _sync_status",
  limpiezas: "id, org_id, farm_id, pool_id, event_date, _sync_status",
  limpieza_products: "id, limpieza_id, _sync_status",
});
```

---

## 4. Validation Schemas (Zod)

File: `src/shared/schemas/limpieza.schema.ts`

```typescript
import { z } from "zod";

const notFutureDate = (val: string) =>
  val <= new Date().toLocaleDateString("en-CA");

const limpiezaProductItemSchema = z.object({
  cleaning_product_type_id: z.string().uuid("Debe seleccionar un producto"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
});

export const createLimpiezaSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta"),
  event_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  products: z
    .array(limpiezaProductItemSchema)
    .min(1, "Debe agregar al menos un producto"),
  notes: z.string().max(2000).optional(),
});

export type CreateLimpiezaInput = z.infer<typeof createLimpiezaSchema>;
```

File: `src/shared/schemas/cleaning-purchase.schema.ts`

```typescript
import { z } from "zod";

const notFutureDate = (val: string) =>
  val <= new Date().toLocaleDateString("en-CA");

export const createCleaningPurchaseSchema = z.object({
  cleaning_product_type_id: z.string().uuid("Debe seleccionar un producto"),
  purchase_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
  supplier: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateCleaningPurchaseInput = z.infer<typeof createCleaningPurchaseSchema>;
```

---

## 5. API Layer

### 5.1 `src/features/limpieza/api/limpieza.api.ts`

**`getLimpiezasByFarm(farmId)`**

- Supabase query: `limpiezas` with `limpieza_products(cleaning_product_type_id, quantity, cleaning_product_types(name))`, `profiles(full_name)`, `pools!pool_id(name)` joins.
- Filter: `farm_id = farmId`, `is_active = true`, order by `event_date DESC`.
- On error: fall back to Dexie `limpiezas` table filtered by `farm_id`.
- On success: cache to Dexie via `bulkPut`.

**`createLimpieza(orgId, farmId, input)`**

- Generate `id` via `generateId()`.
- Build RPC payload: `p_id`, `p_org_id`, `p_farm_id`, `p_pool_id`, `p_event_date`, `p_products` (JSONB), `p_notes`.
- Call `untypedSupabase.rpc("create_limpieza", rpcPayload)`.
- Write `LocalLimpieza` to Dexie with `_sync_status: error ? "pending" : "synced"`.
- On RPC error: `addToOutbox("create_limpieza", id, "RPC", { ...rpcPayload, _entity_table: "limpiezas" })`.
- Return `{ id }`.

### 5.2 `src/features/limpieza/api/cleaning-stock.api.ts`

**`getCleaningStockByFarm(farmId)`**

- Supabase query: `cleaning_product_stock` with `cleaning_product_types(name)` join.
- Filter: `farm_id = farmId`.
- On error: Dexie fallback.
- On success: cache to Dexie.

**`getCleaningPurchasesByFarm(farmId)`**

- Supabase query: `cleaning_product_purchases` with `cleaning_product_types(name)`, `profiles(full_name)` joins.
- Filter: `farm_id = farmId`, `is_active = true`, order by `purchase_date DESC`.
- On error: Dexie fallback.
- On success: cache to Dexie.

**`createCleaningPurchase(orgId, farmId, input)`**

- Generate `id`, call `create_cleaning_product_purchase` RPC, cache to Dexie, outbox on error.

### 5.3 `src/features/limpieza/api/cleaning-product-types.api.ts`

**`getCleaningProductTypes()`**

- Supabase query: `cleaning_product_types` filtered by org, `is_active = true`.
- On error: Dexie fallback.
- On success: cache to Dexie.

---

## 6. Hooks

```
src/features/limpieza/hooks/
  useLimpiezas.ts             — useQuery ["limpiezas", farmId]
  useCreateLimpieza.ts        — useMutation, invalidates ["limpiezas", farmId] and ["cleaning-stock", farmId]
  useCleaningStock.ts         — useQuery ["cleaning-stock", farmId]
  useCreateCleaningPurchase.ts — useMutation, invalidates ["cleaning-stock", farmId] and ["cleaning-purchases", farmId]
  useCleaningProductTypes.ts  — useQuery ["cleaning-product-types"]
  useCleaningPurchases.ts     — useQuery ["cleaning-purchases", farmId]
```

All follow the same pattern as `useMortalidades`/`useCreateMortalidad`:
- `useQuery` wrappers with `enabled: !!farmId`
- `useMutation` wrappers that get `orgId` from `useAuth().profile?.org_id`, invalidate related query keys on success

---

## 7. UI Components

### 7.1 `CleaningProductSelector`

File: `src/features/limpieza/components/CleaningProductSelector.tsx`

Dynamic list for selecting products used in a cleaning:

- Renders a list of product rows. Each row has:
  - **Product select** — dropdown of active cleaning product types. Products already selected in other rows are excluded.
  - **Quantity input** — integer, min 1.
  - **Remove button** — removes the row (disabled if only one row remains).
- **"Agregar producto" button** below the list — adds a new empty row. Disabled when all available products are already selected.
- Exposes `onChange` callback with `Array<{ cleaning_product_type_id: string; quantity: number }>`.

### 7.2 `LimpiezaForm`

File: `src/features/limpieza/components/LimpiezaForm.tsx`

**Props:** `pools` (all active pools of the farm), `cleaningProductTypes`, `isLoading`, `onSubmit`.

**Fields (in order):**

1. **Fecha de ejecución** — date input, defaults to today.
2. **Pileta** — Select. Shows all active pools (both crianza and reproductor). No lote filtering.
3. **Productos utilizados** — `CleaningProductSelector` component.
4. **Notas** — optional textarea.
5. **Submit button** — "Registrar Limpieza".

**Client-side validations:**

- Pool required.
- At least one product with quantity >= 1.
- No duplicate products in the list (handled by excluding already-selected products from the dropdown).
- Zod schema validation before submit.

### 7.3 `LimpiezaListPage`

File: `src/features/limpieza/pages/LimpiezaListPage.tsx`

- Header: "Limpieza (N)" + "Registrar Limpieza" button.
- If `cleaning_frequency_days` is configured and there are overdue pools, show a warning banner: "X piletas con limpieza vencida" (amber/yellow).
- Table with columns:
  - Fecha
  - Pileta
  - Productos (comma-separated product names, e.g. "Sulfato de Cobre, Cal")
  - Responsable
- Sorted by `event_date` descending.
- Empty state: "No hay limpiezas registradas."
- Sub-navigation links to stock page (same pattern as alimentacion → stock).

### 7.4 `CreateLimpiezaPage`

File: `src/features/limpieza/pages/CreateLimpiezaPage.tsx`

- Back arrow + "Registrar Limpieza" heading.
- Loads pools via `usePools(farmId)` and cleaning product types via `useCleaningProductTypes()`.
- Renders `LimpiezaForm`.
- On success: toast "Limpieza registrada exitosamente", navigate to list.
- On error: toast with error message.

### 7.5 `CleaningStockPage`

File: `src/features/limpieza/pages/CleaningStockPage.tsx`

- Header: "Stock de Productos" + "Registrar Compra" button.
- Table with columns:
  - Producto (name)
  - Cantidad actual
  - Umbral de alerta (if configured)
  - Estado (visual indicator: red if below threshold, green otherwise)
- Back link to limpieza list.

### 7.6 `CreateCleaningPurchasePage`

File: `src/features/limpieza/pages/CreateCleaningPurchasePage.tsx`

- Back arrow + "Registrar Compra" heading.
- Form with: product select, date, quantity (integer), supplier (optional), notes (optional).
- On success: toast "Compra registrada exitosamente", navigate to stock page.

---

## 8. Routing

### 8.1 Route constants

Add to `src/shared/constants/routes.ts`:

```typescript
LIMPIEZA: "/farms/:farmId/limpieza",
LIMPIEZA_CREATE: "/farms/:farmId/limpieza/nueva",
LIMPIEZA_STOCK: "/farms/:farmId/limpieza/stock",
LIMPIEZA_STOCK_CREATE: "/farms/:farmId/limpieza/stock/nueva",
```

### 8.2 Router config

Add four routes under the farm layout in `src/app/router.tsx`:

- `limpieza` → `LimpiezaListPage`
- `limpieza/nueva` → `CreateLimpiezaPage`
- `limpieza/stock` → `CleaningStockPage`
- `limpieza/stock/nueva` → `CreateCleaningPurchasePage`

### 8.3 Navigation

Add NavLink in `FarmLayout.tsx` sidebar after "Alimentacion":

```tsx
<NavLink to={ROUTES.LIMPIEZA.replace(":farmId", farmId)} className={navLinkClass}>
  <SprayCanIcon className="size-4" />
  Limpieza
</NavLink>
```

Import `SprayCanIcon` from `lucide-react`.

---

## 9. Frequency & Overdue Alerts

### 9.1 Calculation logic

Pure frontend function in `src/features/limpieza/lib/cleaning-schedule.ts`:

```typescript
interface PoolCleaningStatus {
  poolId: string;
  poolName: string;
  lastCleaningDate: string | null;
  nextDueDate: string | null;
  isOverdue: boolean;
}

function getPoolCleaningStatuses(
  pools: Pool[],
  limpiezas: Limpieza[],
  cleaningFrequencyDays: number | null
): PoolCleaningStatus[]
```

For each active pool:
1. Find `MAX(event_date)` from limpiezas for that pool.
2. If no frequency configured → `isOverdue = false`, `nextDueDate = null`.
3. If never cleaned → `isOverdue = true` (if frequency is configured).
4. Otherwise: `nextDueDate = lastCleaningDate + cleaningFrequencyDays`. `isOverdue = nextDueDate < today`.

### 9.2 Data source for `cleaning_frequency_days`

The farm data (including the new `cleaning_frequency_days` column) is already fetched in the farm context. The `LimpiezaListPage` accesses it through the farm query data available in the layout. No additional query is needed.

### 9.3 Initial state behavior

When `cleaning_frequency_days` is configured but a pool has never been cleaned, it is immediately marked as overdue. This is intentional — it prompts the team to register their first cleaning baseline.

### 9.4 Where it surfaces

- **LimpiezaListPage** — amber banner showing count of overdue pools.
- **Farm dashboard** — alert card (future, when dashboard alerts are implemented per MVP section 13).

---

## 10. Onboarding Integration

### 10.1 New step: "Productos de limpieza"

Inserted after the existing "Tipos de alimento" step (step 3) in the onboarding wizard.

- Same UX pattern as the food types step: editable list with add/remove.
- Pre-loaded defaults: "Sulfato de Cobre", "Azul de Metileno", "Cal".
- User can remove defaults and add custom products.
- Saves to `cleaning_product_types` with `is_default = true` for the pre-loaded ones.

### 10.2 New step: "Frecuencia de limpieza"

After the cleaning products step. Simple numeric input:
- Label: "¿Cada cuántos días se deben limpiar las piletas?"
- Input: integer, optional (can skip)
- Saves to `farms.cleaning_frequency_days` on the first farm.

### 10.3 Onboarding step order (updated)

1. Crear la organización
2. Crear la primera finca
3. Configurar los tipos de alimento
4. **Configurar los productos de limpieza** (new)
5. **Frecuencia de limpieza** (new)
6. Crear las piletas y pozos
7. Configurar el incubador
8. Invitar al primer trabajador (optional)

---

## 11. Feature File Structure

```
src/features/limpieza/
  api/
    limpieza.api.ts
    cleaning-stock.api.ts
    cleaning-product-types.api.ts
  components/
    LimpiezaForm.tsx
    CleaningProductSelector.tsx
  hooks/
    useLimpiezas.ts
    useCreateLimpieza.ts
    useCleaningStock.ts
    useCleaningPurchases.ts
    useCreateCleaningPurchase.ts
    useCleaningProductTypes.ts
  lib/
    cleaning-schedule.ts
  pages/
    LimpiezaListPage.tsx
    CreateLimpiezaPage.tsx
    CleaningStockPage.tsx
    CreateCleaningPurchasePage.tsx
```

**Other files modified:**

- `src/shared/constants/routes.ts` — add 4 route constants
- `src/shared/lib/db.ts` — add 5 interfaces + version 8
- `src/shared/schemas/limpieza.schema.ts` — new file
- `src/shared/schemas/cleaning-purchase.schema.ts` — new file
- `src/app/router.tsx` — add 4 routes + imports
- `src/app/layouts/FarmLayout.tsx` — add nav link
- `src/features/onboarding/` — add 2 new steps (products + frequency)
- `supabase/migrations/00011_limpieza.sql` — new migration (all tables, RLS, RPCs, ALTER farms)

---

## 12. ANLA Report Implications

Limpieza does not directly appear in the ANLA planilla structure described in MVP section 12. Cleaning events are internal operational records — they do not count as animal ingresos, salidas, or mortalidad. No ANLA reporting changes needed.
