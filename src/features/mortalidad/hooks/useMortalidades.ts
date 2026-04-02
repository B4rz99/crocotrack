import { useQuery } from "@tanstack/react-query";
import { getMortalidadesByFarm } from "../api/mortalidad.api";

export function useMortalidades(farmId: string) {
  return useQuery({
    queryKey: ["mortalidades", farmId],
    queryFn: () => getMortalidadesByFarm(farmId),
    enabled: !!farmId,
  });
}
