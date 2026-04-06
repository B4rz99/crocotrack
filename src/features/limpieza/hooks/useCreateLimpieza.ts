import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateLimpiezaInput } from "@/shared/schemas/limpieza.schema";
import { createLimpieza } from "../api/limpieza.api";

export function useCreateLimpieza(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: (input: CreateLimpiezaInput) => {
      if (!orgId) throw new Error("No org_id available");
      return createLimpieza(orgId, farmId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["limpiezas", farmId] });
      queryClient.invalidateQueries({ queryKey: ["cleaning-stock", farmId] });
    },
  });
}
