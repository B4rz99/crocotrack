// src/app/layouts/FarmLayout.tsx
import {
  ArrowLeftRightIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ScissorsIcon,
  SettingsIcon,
  SkullIcon,
  SyringeIcon,
  UtensilsIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { FarmSelector } from "@/features/farms/components/FarmSelector";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { supabase } from "@/shared/lib/supabase";
import { AppShell, navLinkClass } from "../components/AppShell";

export function FarmLayout() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: farms } = useFarms();
  const setLastFarmId = useFarmStore((s) => s.setLastFarmId);

  // Validate farmId against loaded farms; persist to store only after validation passes
  useEffect(() => {
    if (!farms || farms.length === 0) return;
    const isValid = farms.some((f) => f.id === farmId);
    if (isValid) {
      if (farmId) setLastFarmId(farmId);
    } else {
      const firstFarm = farms[0];
      if (firstFarm) {
        navigate(ROUTES.FARM_DASHBOARD.replace(":farmId", firstFarm.id), { replace: true });
      }
    }
  }, [farms, farmId, navigate, setLastFarmId]);

  // Normalize location: Dexie offline farms have location?: string, FarmSelector expects string | null
  const normalizedFarms = useMemo(
    () => farms?.map((f) => ({ ...f, location: f.location ?? null })) ?? [],
    [farms]
  );

  const handleFarmChange = (newFarmId: string) => {
    if (!farmId) return;
    const farmPrefix = `/farms/${farmId}`;
    const suffix = location.pathname.startsWith(farmPrefix)
      ? location.pathname.slice(farmPrefix.length)
      : "";
    navigate(`/farms/${newFarmId}${suffix}`);
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
              farms={normalizedFarms}
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
            <NavLink to={ROUTES.MORTALIDAD.replace(":farmId", farmId)} className={navLinkClass}>
              <SkullIcon className="size-4" />
              Mortalidad
            </NavLink>
            <NavLink to={ROUTES.ALIMENTACION.replace(":farmId", farmId)} className={navLinkClass}>
              <UtensilsIcon className="size-4" />
              Alimentacion
            </NavLink>
            <NavLink to={ROUTES.CLASIFICACION.replace(":farmId", farmId)} className={navLinkClass}>
              <ScissorsIcon className="size-4" />
              Clasificación
            </NavLink>
            <NavLink to={ROUTES.TRASLADOS.replace(":farmId", farmId)} className={navLinkClass}>
              <ArrowLeftRightIcon className="size-4" />
              Traslados
            </NavLink>
            <NavLink to={ROUTES.SACRIFICIOS.replace(":farmId", farmId)} className={navLinkClass}>
              <SyringeIcon className="size-4" />
              Sacrificios
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
