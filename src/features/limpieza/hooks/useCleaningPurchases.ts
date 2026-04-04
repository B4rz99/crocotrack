import { useQuery } from "@tanstack/react-query";
import { getCleaningPurchasesByFarm } from "../api/cleaning-stock.api";

export function useCleaningPurchases(farmId: string) {
  return useQuery({
    queryKey: ["cleaning-purchases", farmId],
    queryFn: () => getCleaningPurchasesByFarm(farmId),
    enabled: !!farmId,
  });
}
