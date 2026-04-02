// src/app/layouts/FarmLayout.tsx
import { ClipboardListIcon, LayoutDashboardIcon, LogOutIcon, SettingsIcon } from "lucide-react";
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
    const newPath = location.pathname.replace(`/farms/${farmId}`, `/farms/${newFarmId}`);
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
            <NavLink to={ROUTES.ENTRADAS.replace(":farmId", farmId)} className={navLinkClass}>
              <ClipboardListIcon className="size-4" />
              Entradas
            </NavLink>
            <div className="my-2 border-t border-sidebar-border" />
            <NavLink to={ROUTES.SETTINGS} end className={navLinkClass}>
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
