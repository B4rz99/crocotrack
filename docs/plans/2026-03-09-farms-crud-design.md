# Farms CRUD + Pool Listing — Design

## Summary

Full CRUD for farms and pools, accessible only to the owner role. Two pages (`/farms`, `/farms/:farmId`) with modal dialogs for create/edit. Soft delete via `is_active = false`. Offline-first reads (Dexie fallback) and writes (sync outbox).

## Pages

### `/farms` — FarmsPage

- Simple list showing farm names only (no location, no pool count)
- Each farm name is a link to `/farms/:farmId`
- Each row has an actions menu: Editar, Eliminar
- "Crear Granja" button at the top
- Queries filter `is_active = true`

### `/farms/:farmId` — FarmDetailPage

- Header with farm name + edit/delete actions
- Pool table with columns: Nombre, Tipo (badge: Crianza/Reproductor), Capacidad
- Table is sortable by any column
- Each row has actions menu: Editar, Eliminar
- "Crear Estanque" button above the table
- Pools filtered by `is_active = true`

## Modals

| Modal | Fields | Validation |
|-------|--------|------------|
| CreateFarmModal | name, location (optional) | `createFarmSchema` |
| EditFarmModal | name, location (optional) | `updateFarmSchema` |
| CreatePoolModal | name, pool_type (select), capacity | `createPoolSchema` |
| EditPoolModal | name, pool_type (select), capacity | `updatePoolSchema` |
| DeleteConfirmDialog | Confirmation text + farm/pool name | n/a |

## Data Layer

### API Functions

**`src/features/farms/api/farms.api.ts`**
- `getFarms(orgId)` — list active farms
- `getFarmById(farmId)` — single farm
- `createFarm(orgId, data)` — insert to Supabase + Dexie
- `updateFarm(farmId, data)` — update in Supabase + Dexie
- `deleteFarm(farmId)` — set `is_active = false`

**`src/features/farms/api/pools.api.ts`**
- `getPoolsByFarm(farmId)` — list active pools for a farm
- `createPool(orgId, farmId, data)` — insert
- `updatePool(poolId, data)` — update
- `deletePool(poolId)` — set `is_active = false`

### Offline Pattern

Each API function follows this pattern:

1. **Writes (create/update/delete):** Try Supabase first. On success, write to Dexie with `_sync_status: "synced"`. On failure, write to Dexie with `_sync_status: "pending"` and add to sync outbox via `addToOutbox()`.
2. **Reads:** Try Supabase first, populate Dexie on success. On failure (offline), fall back to Dexie (IndexedDB) so the app works even after a page refresh while offline.

### TanStack Query Hooks

**`src/features/farms/hooks/`**
- `useFarms()` — queries `getFarms()`, returns `{ farms, isLoading, error }`
- `useFarm(farmId)` — queries `getFarmById()`
- `useCreateFarm()` — mutation, invalidates farms query on success
- `useUpdateFarm()` — mutation, invalidates farms + farm detail
- `useDeleteFarm()` — mutation, invalidates farms
- `usePools(farmId)` — queries `getPoolsByFarm()`
- `useCreatePool()` — mutation, invalidates pools query
- `useUpdatePool()` — mutation, invalidates pools
- `useDeletePool()` — mutation, invalidates pools

## Schemas

Reuse existing `createFarmSchema` and `createPoolSchema`. Add:

- `updateFarmSchema` — same fields as create (name required, location optional)
- `updatePoolSchema` — same fields as create (name, pool_type, capacity)

## Component Structure

```
src/features/farms/
  api/
    farms.api.ts
    pools.api.ts
  components/
    FarmList.tsx           # List of farm rows
    FarmActions.tsx        # Edit/delete dropdown menu per farm
    CreateFarmModal.tsx    # Modal with farm form
    EditFarmModal.tsx      # Modal with pre-filled farm form
    PoolTable.tsx          # Sortable table of pools
    PoolActions.tsx        # Edit/delete dropdown menu per pool
    CreatePoolModal.tsx    # Modal with pool form
    EditPoolModal.tsx      # Modal with pre-filled pool form
    DeleteConfirmDialog.tsx # Reusable confirmation dialog
  hooks/
    useFarms.ts
    useFarm.ts
    usePools.ts
    useFarmMutations.ts   # create/update/delete farm mutations
    usePoolMutations.ts   # create/update/delete pool mutations
  pages/
    FarmsPage.tsx
    FarmDetailPage.tsx
```

## Decisions

- **Soft delete** — `is_active = false`, all queries filter active only
- **Modals for create/edit** — no dedicated edit pages
- **Table for pools** — sortable, dense, good for 150+ pools
- **Farm list shows name only** — minimal, click through for details
- **TanStack Query for server state** — no Zustand store needed for farms/pools
- **Dexie fallback for reads** — offline resilience after page refresh
