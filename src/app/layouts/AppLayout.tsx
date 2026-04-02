import { LayoutDashboardIcon, LogOutIcon, SettingsIcon, WarehouseIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router";
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

const navItems = [
  { to: ROUTES.DASHBOARD, label: "Panel de Control", icon: LayoutDashboardIcon },
  { to: ROUTES.SETTINGS_FARMS, label: "Granjas", icon: WarehouseIcon },
  { to: ROUTES.SETTINGS, label: "Configuración", icon: SettingsIcon },
] as const;

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
              <NavLink key={to} to={to} end={to === ROUTES.DASHBOARD} className={navLinkClass}>
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
