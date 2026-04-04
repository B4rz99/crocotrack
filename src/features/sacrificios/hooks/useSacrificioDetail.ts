import { useQuery } from "@tanstack/react-query";
import { getSacrificioById } from "../api/sacrificios.api";

export function useSacrificioDetail(id: string, farmId: string) {
  return useQuery({
    queryKey: ["sacrificio", id, farmId],
    queryFn: () => getSacrificioById(id, farmId),
    enabled: !!id && !!farmId,
  });
}
