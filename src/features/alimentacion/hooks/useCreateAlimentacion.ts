import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateAlimentacionInput } from "@/shared/schemas/alimentacion.schema";
import { createAlimentacion } from "../api/alimentacion.api";

export function useCreateAlimentacion(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: (input: CreateAlimentacionInput) => {
      if (!orgId) throw new Error("No org_id available");
      return createAlimentacion(orgId, farmId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alimentaciones", farmId] });
      queryClient.invalidateQueries({ queryKey: ["food-stock", farmId] });
    },
  });
}
