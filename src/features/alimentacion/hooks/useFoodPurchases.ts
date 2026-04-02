import { useQuery } from "@tanstack/react-query";
import { getFoodPurchasesByFarm } from "../api/food-stock.api";

export function useFoodPurchases(farmId: string) {
  return useQuery({
    queryKey: ["food-purchases", farmId],
    queryFn: () => getFoodPurchasesByFarm(farmId),
    enabled: !!farmId,
  });
}
