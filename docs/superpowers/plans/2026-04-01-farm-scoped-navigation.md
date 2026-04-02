# Farm-Scoped Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure navigation so selecting a farm scopes the entire app — the dashboard shows that farm's data, and Entradas is a first-class sidebar link instead of being buried inside the farm detail page.

**Architecture:** URL-based farm scoping (`/farms/:farmId/*`). A new `AppShell` component provides the sidebar/header chrome shared by `FarmLayout` and `SettingsLayout`. A `useFarmStore` Zustand store with localStorage persistence tracks the last-visited farm so `/` can redirect to it automatically.

**Tech Stack:** React 19, React Router v7, Zustand 5 (with `persist` middleware), TanStack Query v5, Tailwind v4, shadcn/ui base-nova (`@base-ui/react`), Bun, Vitest + RTL

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/features/farms/stores/farm.store.ts` | Persists `lastFarmId` to localStorage |
| Create | `src/features/farms/stores/__tests__/farm.store.test.ts` | Unit tests for the store |
| Create | `src/app/components/AppShell.tsx` | Shared sidebar/header/content shell |
| Create | `src/features/farms/components/FarmSelector.tsx` | Farm-switcher dropdown |
| Create | `src/app/layouts/FarmLayout.tsx` | Farm-scoped layout: farm selector + nav |
| Create | `src/app/layouts/SettingsLayout.tsx` | Settings layout: settings nav |
| Create | `src/app/components/RedirectToLastFarm.tsx` | Root `/` redirect logic |
| Create | `src/features/farms/pages/FarmDashboardPage.tsx` | Summary cards + pileta table |
| Modify | `src/shared/constants/routes.ts` | Add `FARM_DASHBOARD`, `SETTINGS_FARMS`; remove `FARMS`/`FARM_DETAIL` |
| Modify | `src/app/layouts/AppLayout.tsx` | Thin wrapper around AppShell (kept until router is rewired) |
| Modify | `src/app/router.tsx` | Rewire to FarmLayout + SettingsLayout |
| Modify | `src/features/farms/pages/FarmsPage.tsx` | Rename + store-clear on delete |
| Modify | `src/features/entradas/pages/EntradasListPage.tsx` | Remove back arrow to farm detail |
| Delete | `src/app/layouts/AppLayout.tsx` | Replaced by FarmLayout + SettingsLayout |
| Delete | `src/features/farms/pages/FarmDetailPage.tsx` | Replaced by FarmDashboardPage |

---

## Task 1: Update Route Constants

**Files:**
- Modify: `src/shared/constants/routes.ts`

- [ ] **Step 1: Add new constants (keep existing ones to avoid TS errors in files not yet updated)**

```ts
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARMS: "/farms",                              // kept — still used by AppLayout & router until Tasks 3/10
  FARM_DETAIL: "/farms/:farmId",               // kept — still used by FarmDetailPage until Task 12
  FARM_DASHBOARD: "/farms/:farmId",            // new semantic alias used going forward
  ENTRADAS: "/farms/:farmId/entradas",
  ENTRADA_CREATE: "/farms/:farmId/entradas/nueva",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
  SETTINGS_FARMS: "/settings/farms",           // new
} as const;
```

- [ ] **Step 2: Migrate the two active files from `FARM_DETAIL` → `FARM_DASHBOARD`**

`EntradasListPage.tsx` line 39: `ROUTES.FARM_DETAIL.replace(":farmId", farmId)` → `ROUTES.FARM_DASHBOARD.replace(":farmId", farmId)`

`FarmsPage.tsx` line 57: `ROUTES.FARM_DETAIL.replace(":farmId", farm.id)` → `ROUTES.FARM_DASHBOARD.replace(":farmId", farm.id)`

> `FarmDetailPage.tsx` still uses `ROUTES.FARMS` on its back-arrow — leave it alone. It will be deleted in Task 12.

- [ ] **Step 3: Verify lint passes**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants/routes.ts src/features/farms/pages/FarmDetailPage.tsx src/features/entradas/pages/EntradasListPage.tsx src/features/farms/pages/FarmsPage.tsx
git commit -m "refactor(routes): rename FARM_DETAIL to FARM_DASHBOARD, add SETTINGS_FARMS"
```

---

## Task 2: Create `useFarmStore`

**Files:**
- Create: `src/features/farms/stores/farm.store.ts`
- Create: `src/features/farms/stores/__tests__/farm.store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/farms/stores/__tests__/farm.store.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useFarmStore } from "../farm.store";

describe("useFarmStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useFarmStore.getState().clear();
  });

  afterEach(() => {
    useFarmStore.getState().clear();
    localStorage.clear();
  });

  describe("initial state", () => {
    it("has lastFarmId as null", () => {
      expect(useFarmStore.getState().lastFarmId).toBeNull();
    });
  });

  describe("setLastFarmId", () => {
    it("updates lastFarmId", () => {
      useFarmStore.getState().setLastFarmId("farm-123");
      expect(useFarmStore.getState().lastFarmId).toBe("farm-123");
    });

    it("overwrites a previous value", () => {
      useFarmStore.getState().setLastFarmId("farm-1");
      useFarmStore.getState().setLastFarmId("farm-2");
      expect(useFarmStore.getState().lastFarmId).toBe("farm-2");
    });
  });

  describe("clear", () => {
    it("resets lastFarmId to null", () => {
      useFarmStore.getState().setLastFarmId("farm-123");
      useFarmStore.getState().clear();
      expect(useFarmStore.getState().lastFarmId).toBeNull();
    });
  });

  describe("localStorage persistence", () => {
    it("writes lastFarmId to localStorage", () => {
      useFarmStore.getState().setLastFarmId("farm-456");
      const stored = JSON.parse(localStorage.getItem("crocotrack-farm") ?? "{}");
      expect(stored.state.lastFarmId).toBe("farm-456");
    });

    it("clears localStorage entry on clear()", () => {
      useFarmStore.getState().setLastFarmId("farm-456");
      useFarmStore.getState().clear();
      const stored = JSON.parse(localStorage.getItem("crocotrack-farm") ?? "{}");
      expect(stored.state?.lastFarmId).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/features/farms/stores/__tests__/farm.store.test.ts
```

Expected: FAIL — `Cannot find module '../farm.store'`

- [ ] **Step 3: Implement the store**

```ts
// src/features/farms/stores/farm.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FarmState {
  readonly lastFarmId: string | null;
  readonly setLastFarmId: (farmId: string) => void;
  readonly clear: () => void;
}

export const useFarmStore = create<FarmState>()(
  persist(
    (set) => ({
      lastFarmId: null,
      setLastFarmId: (farmId) => set({ lastFarmId: farmId }),
      clear: () => set({ lastFarmId: null }),
    }),
    {
      name: "crocotrack-farm",
    }
  )
);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/features/farms/stores/__tests__/farm.store.test.ts
```

Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/farms/stores/farm.store.ts src/features/farms/stores/__tests__/farm.store.test.ts
git commit -m "feat(farms): add useFarmStore with localStorage persistence"
```

---

## Task 3: Extract `AppShell`, Update `AppLayout`

**Files:**
- Create: `src/app/components/AppShell.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`

- [ ] **Step 1: Create `AppShell`**

```tsx
// src/app/components/AppShell.tsx
import {
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { useSyncStatus } from "@/shared/hooks/useSyncStatus";

interface AppShellProps {
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const { isOnline } = useOnlineStatus();
  const { pendingCount } = useSyncStatus();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <span className="text-lg font-bold text-primary md:hidden">CrocoTrack</span>

          <div className="ml-auto flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
              </span>
            )}
            <span
              className={`flex items-center gap-1 text-xs ${
                isOnline ? "text-primary" : "text-destructive"
              }`}
            >
              {isOnline ? (
                <WifiIcon className="size-3.5" />
              ) : (
                <WifiOffIcon className="size-3.5" />
              )}
              {isOnline ? "En línea" : "Sin conexión"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AppLayout` to use `AppShell`**

```tsx
// src/app/layouts/AppLayout.tsx
import {
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  WarehouseIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { supabase } from "@/shared/lib/supabase";
import { AppShell } from "../components/AppShell";

const navItems = [
  { to: ROUTES.DASHBOARD, label: "Panel de Control", icon: LayoutDashboardIcon },
  { to: ROUTES.SETTINGS_FARMS, label: "Granjas", icon: WarehouseIcon },
  { to: ROUTES.SETTINGS, label: "Configuración", icon: SettingsIcon },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
  }`;

export function AppLayout() {
  return (
    <AppShell
      sidebar={
        <>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <span className="text-lg font-bold text-sidebar-primary">CrocoTrack</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === ROUTES.DASHBOARD}
                className={navLinkClass}
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOutIcon className="size-4" />
              Cerrar Sesión
            </Button>
          </div>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
```

- [ ] **Step 3: Verify app still looks identical**

```bash
bun run dev
```

Navigate to `/farms` and `/farms/:id`. Sidebar, header, content should look identical to before. This is a zero-visual-change refactor.

- [ ] **Step 4: Run lint**

```bash
bun run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/AppShell.tsx src/app/layouts/AppLayout.tsx
git commit -m "refactor(layout): extract AppShell from AppLayout"
```

---

## Task 4: Build `FarmSelector`

**Files:**
- Create: `src/features/farms/components/FarmSelector.tsx`
- Create: `src/features/farms/components/__tests__/FarmSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/farms/components/__tests__/FarmSelector.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FarmSelector } from "../FarmSelector";

const farms = [
  { id: "farm-1", name: "Granja El Lago", org_id: "org-1", location: null, is_active: true, created_at: "", updated_at: "" },
  { id: "farm-2", name: "Granja Los Pinos", org_id: "org-1", location: null, is_active: true, created_at: "", updated_at: "" },
];

describe("FarmSelector", () => {
  it("renders the current farm name", () => {
    render(
      <FarmSelector
        farms={farms}
        currentFarmId="farm-1"
        onFarmChange={() => {}}
      />
    );
    expect(screen.getByText("Granja El Lago")).toBeInTheDocument();
  });

  it("renders without crashing when farms list is empty", () => {
    render(
      <FarmSelector
        farms={[]}
        currentFarmId=""
        onFarmChange={() => {}}
      />
    );
    // Should render the trigger without errors
    expect(document.querySelector("[data-slot='select-trigger']")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/features/farms/components/__tests__/FarmSelector.test.tsx
```

Expected: FAIL — `Cannot find module '../FarmSelector'`

- [ ] **Step 3: Implement `FarmSelector`**

```tsx
// src/features/farms/components/FarmSelector.tsx
import type { Database } from "@/shared/types/database.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type Farm = Database["public"]["Tables"]["farms"]["Row"];

interface FarmSelectorProps {
  readonly farms: Farm[];
  readonly currentFarmId: string;
  readonly onFarmChange: (farmId: string) => void;
}

export function FarmSelector({ farms, currentFarmId, onFarmChange }: FarmSelectorProps) {
  return (
    <Select
      value={currentFarmId}
      onValueChange={(value) => {
        if (value) onFarmChange(value);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Seleccionar granja" />
      </SelectTrigger>
      <SelectContent>
        {farms.map((farm) => (
          <SelectItem key={farm.id} value={farm.id}>
            {farm.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/features/farms/components/__tests__/FarmSelector.test.tsx
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/farms/components/FarmSelector.tsx src/features/farms/components/__tests__/FarmSelector.test.tsx
git commit -m "feat(farms): add FarmSelector dropdown component"
```

---

## Task 5: Build `FarmLayout`

**Files:**
- Create: `src/app/layouts/FarmLayout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// src/app/layouts/FarmLayout.tsx
import {
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { FarmSelector } from "@/features/farms/components/FarmSelector";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { supabase } from "@/shared/lib/supabase";
import { AppShell } from "../components/AppShell";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
  }`;

export function FarmLayout() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: farms } = useFarms();
  const setLastFarmId = useFarmStore((s) => s.setLastFarmId);

  // Keep the store in sync with the URL
  useEffect(() => {
    if (farmId) setLastFarmId(farmId);
  }, [farmId, setLastFarmId]);

  // If farms loaded and current farmId is invalid, redirect to first available
  useEffect(() => {
    if (!farms || farms.length === 0) return;
    const isValid = farms.some((f) => f.id === farmId);
    if (!isValid) {
      navigate(ROUTES.FARM_DASHBOARD.replace(":farmId", farms[0].id), { replace: true });
    }
  }, [farms, farmId, navigate]);

  const handleFarmChange = (newFarmId: string) => {
    const newPath = location.pathname.replace(
      `/farms/${farmId}`,
      `/farms/${newFarmId}`
    );
    navigate(newPath);
  };

  return (
    <AppShell
      sidebar={
        <>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <span className="text-lg font-bold text-sidebar-primary">CrocoTrack</span>
          </div>
          <div className="border-b border-sidebar-border px-3 py-2">
            <FarmSelector
              farms={farms ?? []}
              currentFarmId={farmId}
              onFarmChange={handleFarmChange}
            />
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <NavLink
              to={ROUTES.FARM_DASHBOARD.replace(":farmId", farmId)}
              end
              className={navLinkClass}
            >
              <LayoutDashboardIcon className="size-4" />
              Panel de Control
            </NavLink>
            <NavLink
              to={ROUTES.ENTRADAS.replace(":farmId", farmId)}
              className={navLinkClass}
            >
              <ClipboardListIcon className="size-4" />
              Entradas
            </NavLink>
            <div className="my-2 border-t border-sidebar-border" />
            <NavLink to={ROUTES.SETTINGS} className={navLinkClass}>
              <SettingsIcon className="size-4" />
              Configuración
            </NavLink>
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOutIcon className="size-4" />
              Cerrar Sesión
            </Button>
          </div>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layouts/FarmLayout.tsx
git commit -m "feat(layout): add FarmLayout with farm selector sidebar"
```

---

## Task 6: Build `RedirectToLastFarm`

**Files:**
- Create: `src/app/components/RedirectToLastFarm.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/components/RedirectToLastFarm.tsx
import { Navigate } from "react-router";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { ROUTES } from "@/shared/constants/routes";

export function RedirectToLastFarm() {
  const lastFarmId = useFarmStore((s) => s.lastFarmId);
  const { data: farms, isPending } = useFarms();

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando...</div>;
  }

  // No farms at all — send to settings to create one
  if (!farms || farms.length === 0) {
    return <Navigate to={ROUTES.SETTINGS_FARMS} replace />;
  }

  // Last farm is still valid → use it
  const target = lastFarmId && farms.some((f) => f.id === lastFarmId)
    ? lastFarmId
    : farms[0].id;

  return <Navigate to={ROUTES.FARM_DASHBOARD.replace(":farmId", target)} replace />;
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/RedirectToLastFarm.tsx
git commit -m "feat(layout): add RedirectToLastFarm for root / route"
```

---

## Task 7: Build `FarmDashboardPage`

**Files:**
- Create: `src/features/farms/pages/FarmDashboardPage.tsx`

This page is built from the content of `FarmDetailPage.tsx`, with the header/farm CRUD removed and summary cards added at the top.

- [ ] **Step 1: Create the page**

```tsx
// src/features/farms/pages/FarmDashboardPage.tsx
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useEntradas } from "@/features/entradas/hooks/useEntradas";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { PoolWithLotes } from "../api/pools.api";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { PoolFormModal } from "../components/PoolFormModal";
import { useCreatePool, useDeletePool, useUpdatePool } from "../hooks/usePoolMutations";
import { usePools } from "../hooks/usePools";

type SortKey = "name" | "pool_type" | "capacity";
type SortDir = "asc" | "desc";

const getActiveLote = (pool: PoolWithLotes) =>
  pool.lotes[0] as PoolWithLotes["lotes"][number] | undefined;

const getTotalAnimals = (pool: PoolWithLotes): number | null => {
  const lote = getActiveLote(pool);
  if (!lote) return null;
  return lote.lote_size_compositions.reduce((sum, c) => sum + c.animal_count, 0);
};

const getSizesList = (pool: PoolWithLotes): string => {
  const lote = getActiveLote(pool);
  if (!lote || lote.lote_size_compositions.length === 0) return "";
  return lote.lote_size_compositions.map((c) => `${c.size_inches}"`).join(", ");
};

export function FarmDashboardPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: pools, isLoading: poolsLoading, error: poolsError } = usePools(farmId);
  const { data: entradas } = useEntradas(farmId);

  const createPool = useCreatePool(farmId);
  const updatePool = useUpdatePool(farmId);
  const deletePoolMutation = useDeletePool(farmId);

  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [editPool, setEditPool] = useState<{
    id: string;
    name: string;
    pool_type: "crianza" | "reproductor";
    capacity?: number | null;
    code?: string | null;
  } | null>(null);
  const [deletePoolTarget, setDeletePoolTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedPools = useMemo(
    () =>
      pools
        ? [...pools].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
          })
        : [],
    [pools, sortKey, sortDir]
  );

  // Summary stats derived from existing data
  const totalAnimals = pools?.reduce((sum, pool) => sum + (getTotalAnimals(pool) ?? 0), 0) ?? 0;
  const totalPiletas = pools?.length ?? 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEntradas =
    entradas?.filter((e) => new Date(e.entry_date) >= thirtyDaysAgo).length ?? 0;

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (poolsLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (poolsError) {
    return <div className="text-sm text-destructive">Error al cargar datos de la granja.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Animales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAnimals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Piletas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPiletas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entradas (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recentEntradas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pileta table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Piletas ({sortedPools.length})
          </h2>
          <Button onClick={() => setCreatePoolOpen(true)} size="sm">
            <PlusIcon className="mr-1 size-4" />
            Crear Pileta
          </Button>
        </div>

        {sortedPools.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Nombre{sortIndicator("name")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("pool_type")}
                >
                  Tipo{sortIndicator("pool_type")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("capacity")}
                >
                  Capacidad{sortIndicator("capacity")}
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Animales</TableHead>
                <TableHead>Tamaños</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPools.map((pool) => {
                const hasActiveLote = !!getActiveLote(pool);
                const totalPoolAnimals = getTotalAnimals(pool);
                const sizes = getSizesList(pool);

                return (
                  <TableRow key={pool.id}>
                    <TableCell className="font-medium">{pool.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          pool.pool_type === "reproductor"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {pool.pool_type === "reproductor" ? "Reproductor" : "Crianza"}
                      </span>
                    </TableCell>
                    <TableCell>{pool.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          hasActiveLote
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {hasActiveLote ? "Con lote" : "Vacía"}
                      </span>
                    </TableCell>
                    <TableCell>{totalPoolAnimals ?? "—"}</TableCell>
                    <TableCell>{sizes || "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Acciones de pileta"
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditPool({
                                id: pool.id,
                                name: pool.name,
                                pool_type: pool.pool_type,
                                capacity: pool.capacity,
                                code: pool.code,
                              })
                            }
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDeletePoolTarget({ id: pool.id, name: pool.name })
                            }
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay piletas creadas.</p>
        )}
      </div>

      {/* Pool modals */}
      <PoolFormModal
        open={createPoolOpen}
        onOpenChange={setCreatePoolOpen}
        isLoading={createPool.isPending}
        onSubmit={(data) => {
          createPool.mutate(data, {
            onSuccess: () => setCreatePoolOpen(false),
          });
        }}
      />

      <PoolFormModal
        open={!!editPool}
        onOpenChange={(open) => {
          if (!open) setEditPool(null);
        }}
        pool={editPool}
        isLoading={updatePool.isPending}
        onSubmit={(data) => {
          if (!editPool) return;
          updatePool.mutate(
            { poolId: editPool.id, input: data },
            { onSuccess: () => setEditPool(null) }
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deletePoolTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePoolTarget(null);
        }}
        title="Eliminar Pileta"
        description={`¿Estás seguro de eliminar "${deletePoolTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deletePoolMutation.isPending}
        onConfirm={() => {
          if (!deletePoolTarget) return;
          deletePoolMutation.mutate(deletePoolTarget.id, {
            onSuccess: () => setDeletePoolTarget(null),
          });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/features/farms/pages/FarmDashboardPage.tsx
git commit -m "feat(farms): add FarmDashboardPage with summary cards and pileta table"
```

---

## Task 8: Build `SettingsLayout`

**Files:**
- Create: `src/app/layouts/SettingsLayout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// src/app/layouts/SettingsLayout.tsx
import {
  ArrowLeftIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { supabase } from "@/shared/lib/supabase";
import { AppShell } from "../components/AppShell";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
  }`;

export function SettingsLayout() {
  const lastFarmId = useFarmStore((s) => s.lastFarmId);
  const backTo = lastFarmId
    ? ROUTES.FARM_DASHBOARD.replace(":farmId", lastFarmId)
    : ROUTES.DASHBOARD;

  return (
    <AppShell
      sidebar={
        <>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <span className="text-lg font-bold text-sidebar-primary">CrocoTrack</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <NavLink to={ROUTES.SETTINGS} end className={navLinkClass}>
              <SettingsIcon className="size-4" />
              General
            </NavLink>
            <NavLink to={ROUTES.SETTINGS_TEAM} className={navLinkClass}>
              <UsersIcon className="size-4" />
              Equipo
            </NavLink>
            <NavLink to={ROUTES.SETTINGS_FARMS} className={navLinkClass}>
              <WarehouseIcon className="size-4" />
              Granjas
            </NavLink>
            <div className="my-2 border-t border-sidebar-border" />
            <NavLink to={backTo} className={navLinkClass}>
              <ArrowLeftIcon className="size-4" />
              Volver a Granja
            </NavLink>
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOutIcon className="size-4" />
              Cerrar Sesión
            </Button>
          </div>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layouts/SettingsLayout.tsx
git commit -m "feat(layout): add SettingsLayout with settings sidebar nav"
```

---

## Task 9: Build `FarmsManagementPage`

**Files:**
- Modify: `src/features/farms/pages/FarmsPage.tsx` (transform in-place, rename later in cleanup)

This is the current `FarmsPage` with two changes:
1. Links use `ROUTES.FARM_DASHBOARD` instead of the now-deleted `ROUTES.FARM_DETAIL`
2. On farm deletion, clears `lastFarmId` if the deleted farm was the stored one

- [ ] **Step 1: Replace `FarmsPage.tsx` contents**

```tsx
// src/features/farms/pages/FarmsPage.tsx
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ROUTES } from "@/shared/constants/routes";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { FarmFormModal } from "../components/FarmFormModal";
import { useCreateFarm, useDeleteFarm, useUpdateFarm } from "../hooks/useFarmMutations";
import { useFarms } from "../hooks/useFarms";

export function FarmsPage() {
  const { data: farms, isPending, error } = useFarms();
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();
  const lastFarmId = useFarmStore((s) => s.lastFarmId);
  const clearLastFarm = useFarmStore((s) => s.clear);

  const [createOpen, setCreateOpen] = useState(false);
  const [editFarm, setEditFarm] = useState<{
    id: string;
    name: string;
    location?: string | null;
  } | null>(null);
  const [deleteFarmTarget, setDeleteFarmTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (isPending) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar granjas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Granjas</h1>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <PlusIcon className="mr-1 size-4" />
          Crear Granja
        </Button>
      </div>

      {farms && farms.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {farms.map((farm) => (
            <li key={farm.id} className="flex items-center justify-between px-4 py-3">
              <Link
                to={ROUTES.FARM_DASHBOARD.replace(":farmId", farm.id)}
                className="text-sm font-medium hover:underline"
              >
                {farm.name}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label="Acciones" />}
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setEditFarm({
                        id: farm.id,
                        name: farm.name,
                        location: farm.location,
                      })
                    }
                  >
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setDeleteFarmTarget({
                        id: farm.id,
                        name: farm.name,
                      })
                    }
                  >
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No hay granjas creadas.</p>
      )}

      <FarmFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        isLoading={createFarm.isPending}
        onSubmit={(data) => {
          createFarm.mutate(data, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
      />

      <FarmFormModal
        open={!!editFarm}
        onOpenChange={(open) => {
          if (!open) setEditFarm(null);
        }}
        farm={editFarm}
        isLoading={updateFarm.isPending}
        onSubmit={(data) => {
          if (!editFarm) return;
          updateFarm.mutate(
            { farmId: editFarm.id, input: data },
            { onSuccess: () => setEditFarm(null) }
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteFarmTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteFarmTarget(null);
        }}
        title="Eliminar Granja"
        description={`¿Estás seguro de eliminar "${deleteFarmTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deleteFarmMutation.isPending}
        onConfirm={() => {
          if (!deleteFarmTarget) return;
          deleteFarmMutation.mutate(deleteFarmTarget.id, {
            onSuccess: () => {
              if (deleteFarmTarget.id === lastFarmId) {
                clearLastFarm();
              }
              setDeleteFarmTarget(null);
            },
          });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/features/farms/pages/FarmsPage.tsx
git commit -m "feat(farms): update FarmsPage for settings context, clear store on delete"
```

---

## Task 10: Rewire the Router

This is the integration step. All new layouts and pages must exist before this task.

**Files:**
- Modify: `src/app/router.tsx`

- [ ] **Step 1: Rewrite the router**

```tsx
// src/app/router.tsx
import { Navigate, createBrowserRouter } from "react-router";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { CreateEntradaPage } from "@/features/entradas/pages/CreateEntradaPage";
import { EntradasListPage } from "@/features/entradas/pages/EntradasListPage";
import { FarmDashboardPage } from "@/features/farms/pages/FarmDashboardPage";
import { FarmsPage } from "@/features/farms/pages/FarmsPage";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { ROUTES } from "@/shared/constants/routes";
import { RedirectToLastFarm } from "./components/RedirectToLastFarm";
import { FarmLayout } from "./layouts/FarmLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { OnboardingLayout } from "./layouts/OnboardingLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";

/* ---------- Placeholder pages ---------- */
const InvitePage = () => <div>Invite</div>;
const SettingsPage = () => <div>Settings</div>;
const SettingsTeamPage = () => <div>Settings Team</div>;

/* ---------- Router ---------- */

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.REGISTER, element: <RegisterPage /> },
      { path: ROUTES.INVITE, element: <InvitePage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.ONBOARDING,
        element: <OnboardingLayout />,
        children: [{ index: true, element: <OnboardingPage /> }],
      },
      // Root: redirect to last farm
      { path: ROUTES.DASHBOARD, element: <RedirectToLastFarm /> },
      // Backward-compat: old /farms list now lives at /settings/farms
      { path: "/farms", element: <Navigate to={ROUTES.SETTINGS_FARMS} replace /> },
      // Farm-scoped routes
      {
        path: ROUTES.FARM_DASHBOARD,
        element: <FarmLayout />,
        children: [
          { index: true, element: <FarmDashboardPage /> },
          { path: "entradas", element: <EntradasListPage /> },
          { path: "entradas/nueva", element: <CreateEntradaPage /> },
        ],
      },
      // Settings routes
      {
        path: ROUTES.SETTINGS,
        element: <SettingsLayout />,
        children: [
          { index: true, element: <SettingsPage /> },
          { path: "team", element: <SettingsTeamPage /> },
          { path: "farms", element: <FarmsPage /> },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 2: Run the full test suite to catch regressions**

```bash
bun run test
```

Expected: all existing tests pass (the auth/ProtectedRoute tests reference `ROUTES.DASHBOARD` which is still `"/"` — `RedirectToLastFarm` renders there, but the tests use `MemoryRouter` and won't hit the actual redirect logic).

- [ ] **Step 3: Manual smoke test in the browser**

```bash
bun run dev
```

Verify:
1. Navigate to `http://localhost:5173/` → redirects to `/farms/:id`
2. Farm dashboard shows summary cards + pileta table
3. Sidebar shows: farm selector, Panel de Control, Entradas, Configuración
4. Click "Entradas" in sidebar → goes to `/farms/:id/entradas`
5. Switch farm in selector → URL changes, content updates
6. Click "Configuración" in sidebar → goes to `/settings`, settings sidebar appears
7. In settings, click "Granjas" → farm list with create/edit/delete
8. Click "Volver a Granja" → returns to farm dashboard

- [ ] **Step 4: Lint**

```bash
bun run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/router.tsx
git commit -m "feat(router): rewire to farm-scoped layout with FarmLayout and SettingsLayout"
```

---

## Task 11: Clean Up `EntradasListPage`

The back arrow in `EntradasListPage` linked to the farm detail page — now the sidebar handles navigation.

**Files:**
- Modify: `src/features/entradas/pages/EntradasListPage.tsx`

- [ ] **Step 1: Remove the back arrow and its variables**

Replace the current file content with:

```tsx
// src/features/entradas/pages/EntradasListPage.tsx
import { PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ROUTES } from "@/shared/constants/routes";
import type { EntradaOriginType } from "@/shared/schemas/entrada.schema";
import { useEntradas } from "../hooks/useEntradas";

const ORIGIN_LABELS: Record<EntradaOriginType, string> = {
  proveedor_persona: "Proveedor Persona",
  proveedor_empresa: "Proveedor Empresa",
  finca_propia: "Finca Propia",
  incubador: "Incubador",
};

const ORIGIN_COLORS: Record<EntradaOriginType, string> = {
  proveedor_persona: "bg-blue-100 text-blue-700",
  proveedor_empresa: "bg-purple-100 text-purple-700",
  finca_propia: "bg-green-100 text-green-700",
  incubador: "bg-amber-100 text-amber-700",
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function EntradasListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: entradas, isLoading, error } = useEntradas(farmId);

  const createPath = ROUTES.ENTRADA_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las entradas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Entradas ({entradas?.length ?? 0})</h1>
        <Link to={createPath}>
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Nueva Entrada
          </Button>
        </Link>
      </div>

      {entradas && entradas.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo Origen</TableHead>
              <TableHead>Pileta</TableHead>
              <TableHead>Total Animales</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entradas.map((entrada) => (
              <TableRow key={entrada.id}>
                <TableCell>{formatDate(entrada.entry_date)}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      ORIGIN_COLORS[entrada.origin_type]
                    }`}
                  >
                    {ORIGIN_LABELS[entrada.origin_type]}
                  </span>
                </TableCell>
                <TableCell>{entrada.pools?.name ?? "—"}</TableCell>
                <TableCell>{entrada.total_animals}</TableCell>
                <TableCell>{entrada.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay entradas registradas.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/features/entradas/pages/EntradasListPage.tsx
git commit -m "refactor(entradas): remove back-arrow now that sidebar handles navigation"
```

---

## Task 12: Delete Dead Files

**Files:**
- Delete: `src/app/layouts/AppLayout.tsx`
- Delete: `src/features/farms/pages/FarmDetailPage.tsx`

- [ ] **Step 1: Verify nothing imports AppLayout or FarmDetailPage**

```bash
grep -r "AppLayout\|FarmDetailPage" src/ --include="*.ts" --include="*.tsx"
```

Expected: no output (both were removed from the router in Task 10).

- [ ] **Step 2: Delete the files**

```bash
rm src/app/layouts/AppLayout.tsx
rm src/features/farms/pages/FarmDetailPage.tsx
```

- [ ] **Step 3: Remove the now-unused route constants**

In `src/shared/constants/routes.ts`, remove `FARMS` and `FARM_DETAIL` (both are no longer referenced anywhere):

```ts
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

- [ ] **Step 4: Run the full test suite**

```bash
bun run test
```

Expected: all tests pass.

- [ ] **Step 5: Lint**

```bash
bun run lint
```

- [ ] **Step 6: Final browser smoke test**

Repeat the smoke test from Task 10, Step 3 to confirm everything still works after the deletes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete AppLayout and FarmDetailPage replaced by new layout system"
```

---

## Verification Checklist

- [ ] `/` redirects to `/farms/:id` (last visited or first available)
- [ ] Farm dashboard at `/farms/:id` shows 3 summary cards + sortable pileta table
- [ ] Pool CRUD (create/edit/delete) works from the dashboard
- [ ] Sidebar shows: farm selector, Panel de Control, Entradas, separator, Configuración
- [ ] Farm selector switching preserves sub-route (e.g., switching while on `/entradas` stays on `/entradas`)
- [ ] Entradas list at `/farms/:id/entradas` — no back arrow, "Nueva Entrada" button works
- [ ] Create entrada → back arrow returns to entradas list
- [ ] Settings at `/settings` shows settings-specific sidebar (General, Equipo, Granjas, Volver a Granja)
- [ ] `/settings/farms` shows farm list with create/edit/delete
- [ ] Deleting the currently-active farm clears `lastFarmId` from localStorage
- [ ] Reloading the page restores the last-visited farm
- [ ] Old `/farms` URL redirects to `/settings/farms`
- [ ] `bun run test` — all tests pass
- [ ] `bun run lint` — no errors
