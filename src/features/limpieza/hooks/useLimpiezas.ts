import { useQuery } from "@tanstack/react-query";
import { getLimpiezasByFarm } from "../api/limpieza.api";

export function useLimpiezas(farmId: string) {
  return useQuery({
    queryKey: ["limpiezas", farmId],
    queryFn: () => getLimpiezasByFarm(farmId),
    enabled: !!farmId,
  });
}
