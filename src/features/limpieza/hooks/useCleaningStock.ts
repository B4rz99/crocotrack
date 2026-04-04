import { useQuery } from "@tanstack/react-query";
import { getCleaningStockByFarm } from "../api/cleaning-stock.api";

export function useCleaningStock(farmId: string) {
  return useQuery({
    queryKey: ["cleaning-stock", farmId],
    queryFn: () => getCleaningStockByFarm(farmId),
    enabled: !!farmId,
  });
}
