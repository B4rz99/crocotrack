import { useQuery } from "@tanstack/react-query";
import { getFarmById } from "../api/farms.api";

export function useFarm(farmId: string) {
  return useQuery({
    queryKey: ["farms", farmId],
    queryFn: () => getFarmById(farmId),
    enabled: !!farmId,
  });
}
