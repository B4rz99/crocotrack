# Farm-Scoped Navigation Restructure

## Context

Currently, CrocoTrack has a flat navigation model: a static sidebar with 3 links (Dashboard, Granjas, Configuración). The Dashboard is a placeholder. Clicking a farm in the Granjas list navigates to a detail page with piletas and an "Entradas" button buried 2 clicks deep.

The app should work as a **farm-scoped experience**: the user selects a farm and all views render in that farm's context. Entradas becomes a first-class sidebar item instead of being nested under the farm detail page.

## Architecture: URL-Based Farm Scoping (Approach B)

The `farmId` stays in the URL as the source of truth. A Zustand store persists only the **last selected farm** to localStorage for the root redirect. This preserves deep-linking, bookmarking, and natural back-button behavior.

## Route Structure

```
[AuthLayout]
  /login, /register, /invite/:token          (unchanged)

[ProtectedRoute]
  /onboarding                                 (unchanged)

  /                → RedirectToLastFarm        (redirects to /farms/:farmId)
  /farms           → redirect to /settings/farms (backward compat)

  /farms/:farmId   → FarmLayout
    index           → FarmDashboardPage        (summary cards + pileta table)
    entradas        → EntradasListPage         (existing, minor cleanup)
    entradas/nueva  → CreateEntradaPage        (existing, minor cleanup)

  /settings        → SettingsLayout
    index           → SettingsPage             (placeholder, existing)
    team            → SettingsTeamPage         (placeholder, existing)
    farms           → FarmsManagementPage      (farm CRUD moved here)
```

### Route Constants Update

```ts
// routes.ts — final state
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARM_DASHBOARD: "/farms/:farmId",
  ENTRADAS: "/farms/:farmId/entradas",
  ENTRADA_CREATE: "/farms/:farmId/entradas/nueva",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
  SETTINGS_FARMS: "/settings/farms",
} as const;
```

Removed: `FARMS` (no longer a top-level route), `FARM_DETAIL` (renamed to `FARM_DASHBOARD`).

## Sidebar & Farm Selector

### FarmLayout Sidebar

```
┌──────────────────────────┐
│  CrocoTrack              │
├──────────────────────────┤
│  [ Granja El Lago    ▾]  │  ← Farm selector dropdown
├──────────────────────────┤
│  ● Panel de Control      │  → /farms/:farmId
│  ○ Entradas              │  → /farms/:farmId/entradas
├──────────────────────────┤
│  ○ Configuración         │  → /settings
│  Cerrar Sesión           │
└──────────────────────────┘
```

### Farm Selector Behavior

- Dropdown lists all farms from `useFarms()` hook
- Shows current farm name as trigger text
- On farm change: navigates to `/farms/:newFarmId`, preserving current sub-route (e.g., if on `/farms/abc/entradas`, switching to farm `xyz` goes to `/farms/xyz/entradas`)
- Implementation: `location.pathname.replace(\`/farms/${farmId}\`, \`/farms/${newFarmId}\`)`
- Uses existing shadcn `Select` component from `src/shared/components/ui/select.tsx`

### SettingsLayout Sidebar

```
┌──────────────────────────┐
│  CrocoTrack              │
├──────────────────────────┤
│  ● General               │  → /settings
│  ○ Equipo                │  → /settings/team
│  ○ Granjas               │  → /settings/farms
├──────────────────────────┤
│  ← Volver a Granja       │  → /farms/:lastFarmId
│  Cerrar Sesión           │
└──────────────────────────┘
```

### Shared AppShell Component

Both layouts share an `AppShell` component extracted from the current `AppLayout`. It provides:
- Sidebar chrome (border, fixed width 256px, hidden on mobile)
- Header bar with online/offline status, pending sync count, mobile logo
- Main content area

Props: `sidebarHeader`, `sidebarNav`, `sidebarFooter`, `children`

## State Management

### New Zustand Store: `useFarmStore`

```ts
// src/features/farms/stores/farm.store.ts
interface FarmState {
  readonly lastFarmId: string | null;
  readonly setLastFarmId: (farmId: string) => void;
  readonly clear: () => void;
}
```

- Uses `zustand/middleware` `persist` with localStorage key `"crocotrack-farm"`
- `FarmLayout` syncs URL `farmId` → store via `useEffect`
- `RedirectToLastFarm` reads store to determine redirect target
- On farm deletion in settings: call `clear()` if deleted farm matches `lastFarmId`

### RedirectToLastFarm Component

```
src/app/components/RedirectToLastFarm.tsx
```

Logic:
1. Read `lastFarmId` from store
2. Fetch farms via `useFarms()`
3. If loading → spinner
4. If `lastFarmId` exists and is in list → `<Navigate to="/farms/${lastFarmId}" replace />`
5. Else if farms exist → redirect to first farm
6. Else (no farms) → redirect to `/settings/farms`

## Farm Dashboard Page

`src/features/farms/pages/FarmDashboardPage.tsx` at `/farms/:farmId`

### Summary Cards (top)

Three cards in a responsive grid:
- **Total Animales** — sum of animals across all pools' active lotes (from `usePools`)
- **Total Piletas** — pool count (from `usePools`)
- **Entradas Recientes** — count of entradas in last 30 days (from `useEntradas`)

All derived from existing hooks. No new API endpoints.

### Pileta Table (below cards)

Moved from `FarmDetailPage`: the sortable table with pool name, type, capacity, lote status, animal count, sizes, and action dropdown (edit/delete pool).

### Removed from current FarmDetailPage

- Back arrow to `/farms`
- Farm name `<h1>` (now in sidebar farm selector)
- Farm edit/delete dropdown (moved to Settings)
- "Entradas" button link (now in sidebar)

### Kept from current FarmDetailPage

- All pool CRUD modals (create, edit, delete pool)
- Sort logic
- Helper functions (`getActiveLote`, `getTotalAnimals`, `getSizesList`)

## Settings: Farm Management

`src/features/farms/pages/FarmsManagementPage.tsx` at `/settings/farms`

Reuses the existing `FarmsPage` content:
- Farm list with create/edit/delete modals
- "Crear Granja" button
- Uses existing `FarmFormModal` and `DeleteConfirmDialog`

On farm deletion: if the deleted farm equals `lastFarmId`, call `useFarmStore.clear()` and redirect to `/`.

## Entradas Changes (Minimal)

- `EntradasListPage`: remove back arrow to farm detail (sidebar handles navigation)
- `CreateEntradaPage`: keep back arrow to entradas list (useful contextual nav within the form flow)

## File Inventory

### New Files (8)

| File | Purpose |
|------|---------|
| `src/features/farms/stores/farm.store.ts` | Zustand store for lastFarmId persistence |
| `src/features/farms/stores/__tests__/farm.store.test.ts` | Store unit tests |
| `src/app/components/AppShell.tsx` | Shared sidebar/header/content shell |
| `src/features/farms/components/FarmSelector.tsx` | Farm dropdown selector |
| `src/app/layouts/FarmLayout.tsx` | Farm-scoped layout with sidebar |
| `src/app/layouts/SettingsLayout.tsx` | Settings layout with sidebar |
| `src/app/components/RedirectToLastFarm.tsx` | Root redirect component |
| `src/features/farms/pages/FarmDashboardPage.tsx` | New farm dashboard |

### Modified Files (4)

| File | Changes |
|------|---------|
| `src/shared/constants/routes.ts` | Update constants (remove FARMS/FARM_DETAIL, add FARM_DASHBOARD/SETTINGS_FARMS) |
| `src/app/router.tsx` | Rewrite route tree |
| `src/features/entradas/pages/EntradasListPage.tsx` | Remove back arrow |
| `src/features/farms/pages/FarmsPage.tsx` | Rename to FarmsManagementPage, adjust heading |

### Deleted Files (2)

| File | Reason |
|------|--------|
| `src/app/layouts/AppLayout.tsx` | Replaced by FarmLayout + SettingsLayout + AppShell |
| `src/features/farms/pages/FarmDetailPage.tsx` | Replaced by FarmDashboardPage |

## Edge Cases

- **No farms exist:** `RedirectToLastFarm` sends to `/settings/farms` with a "Crear Granja" CTA
- **Invalid farmId in URL:** `FarmLayout` detects farm not in list → redirects to first available farm
- **Farm deleted while active:** `FarmsManagementPage` clears `lastFarmId` from store → redirect to `/`
- **Bookmark to old `/farms`:** Catch-all redirect `{ path: "/farms", element: <Navigate to="/settings/farms" /> }`

## Verification

1. Navigate to `/` → redirects to `/farms/:firstFarmId`
2. Farm dashboard shows summary cards + pileta table
3. Switch farms via selector → URL updates, content refreshes, sub-route preserved
4. Sidebar "Entradas" link → entradas list for current farm
5. Create nueva entrada → navigate back to list works
6. Settings → Granjas → create/edit/delete farm works
7. Delete current farm → redirects to a valid farm or settings
8. Reload page → last farm restored from localStorage
9. `bun run lint` passes
10. `bun run test` passes
