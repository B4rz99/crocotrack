import { useQuery } from "@tanstack/react-query";
import { getPoolsByFarm } from "../api/pools.api";

export function usePools(farmId: string) {
  return useQuery({
    queryKey: ["pools", farmId],
    queryFn: () => getPoolsByFarm(farmId),
    enabled: !!farmId,
  });
}
