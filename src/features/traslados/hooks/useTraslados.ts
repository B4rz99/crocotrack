import { useQuery } from "@tanstack/react-query";
import { getTrasladosByFarm } from "../api/traslados.api";

export function useTraslados(farmId: string) {
  return useQuery({
    queryKey: ["traslados", farmId],
    queryFn: () => getTrasladosByFarm(farmId),
    enabled: !!farmId,
  });
}
