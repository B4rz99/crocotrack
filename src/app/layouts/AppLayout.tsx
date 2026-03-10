import {
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  WarehouseIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { useSyncStatus } from "@/shared/hooks/useSyncStatus";
import { supabase } from "@/shared/lib/supabase";

const navItems = [
  { to: ROUTES.DASHBOARD, label: "Panel de Control", icon: LayoutDashboardIcon },
  { to: ROUTES.FARMS, label: "Granjas", icon: WarehouseIcon },
  { to: ROUTES.SETTINGS, label: "Configuración", icon: SettingsIcon },
] as const;

export function AppLayout() {
  const { isOnline } = useOnlineStatus();
  const { pendingCount } = useSyncStatus();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <span className="text-lg font-bold text-sidebar-primary">CrocoTrack</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === ROUTES.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`
              }
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
              {isOnline ? <WifiIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
              {isOnline ? "En línea" : "Sin conexión"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
