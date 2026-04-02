import { useQuery } from "@tanstack/react-query";
import { getAlimentacionesByFarm } from "../api/alimentacion.api";

export function useAlimentaciones(farmId: string) {
  return useQuery({
    queryKey: ["alimentaciones", farmId],
    queryFn: () => getAlimentacionesByFarm(farmId),
    enabled: !!farmId,
  });
}
