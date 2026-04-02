// src/app/components/RedirectToLastFarm.tsx
import { Navigate } from "react-router";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { useFarmStore } from "@/features/farms/stores/farm.store";
import { ROUTES } from "@/shared/constants/routes";

export function RedirectToLastFarm() {
  const lastFarmId = useFarmStore((s) => s.lastFarmId);
  const { data: farms, isPending } = useFarms();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  // No farms at all — send to settings to create one
  if (!farms || farms.length === 0) {
    return <Navigate to={ROUTES.SETTINGS_FARMS} replace />;
  }

  // Last farm is still valid → use it; otherwise fall back to first farm
  const target = lastFarmId && farms.some((f) => f.id === lastFarmId) ? lastFarmId : farms[0]?.id;

  if (!target) {
    return <Navigate to={ROUTES.SETTINGS_FARMS} replace />;
  }

  return <Navigate to={ROUTES.FARM_DASHBOARD.replace(":farmId", target)} replace />;
}
