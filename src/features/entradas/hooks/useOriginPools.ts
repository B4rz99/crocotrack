import { useQuery } from "@tanstack/react-query";
import { getPoolsByFarm, type PoolWithLotes } from "@/features/farms/api/pools.api";

const selectPoolsWithLotes = (pools: PoolWithLotes[]) => pools.filter((p) => p.lotes.length > 0);

export function useOriginPools(farmId: string | undefined) {
  return useQuery({
    queryKey: ["pools", farmId],
    queryFn: () => getPoolsByFarm(farmId as string),
    enabled: !!farmId,
    select: selectPoolsWithLotes,
  });
}
