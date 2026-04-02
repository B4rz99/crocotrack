import { useQuery } from "@tanstack/react-query";
import { getFoodStockByFarm } from "../api/food-stock.api";

export function useFoodStock(farmId: string) {
  return useQuery({
    queryKey: ["food-stock", farmId],
    queryFn: () => getFoodStockByFarm(farmId),
    enabled: !!farmId,
  });
}
