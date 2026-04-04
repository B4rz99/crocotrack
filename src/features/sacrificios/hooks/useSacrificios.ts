import { useQuery } from "@tanstack/react-query";
import { getSacrificiosByFarm } from "../api/sacrificios.api";

export function useSacrificios(farmId: string) {
  return useQuery({
    queryKey: ["sacrificios", farmId],
    queryFn: () => getSacrificiosByFarm(farmId),
    enabled: !!farmId,
  });
}
