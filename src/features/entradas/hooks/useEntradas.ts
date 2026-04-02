import { useQuery } from "@tanstack/react-query";
import { getEntradasByFarm } from "../api/entradas.api";

export function useEntradas(farmId: string) {
  return useQuery({
    queryKey: ["entradas", farmId],
    queryFn: () => getEntradasByFarm(farmId),
    enabled: !!farmId,
  });
}
