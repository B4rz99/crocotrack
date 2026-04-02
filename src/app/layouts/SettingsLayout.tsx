// src/app/layouts/SettingsLayout.tsx
import { ArrowLeftIcon, LogOutIcon, SettingsIcon, UsersIcon, WarehouseIcon } from "lucide-react";
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
