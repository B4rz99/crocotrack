import { useQuery } from "@tanstack/react-query";
import { getSacrificioById } from "../api/sacrificios.api";

export function useSacrificioDetail(id: string) {
  return useQuery({
    queryKey: ["sacrificio", id],
    queryFn: () => getSacrificioById(id),
    enabled: !!id,
  });
}
