import { useQuery } from "@tanstack/react-query";
import { getClasificacionesByFarm } from "../api/clasificacion.api";

export function useClasificaciones(farmId: string) {
  return useQuery({
    queryKey: ["clasificaciones", farmId],
    queryFn: () => getClasificacionesByFarm(farmId),
    enabled: !!farmId,
  });
}
