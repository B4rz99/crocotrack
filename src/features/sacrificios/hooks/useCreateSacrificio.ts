import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateSacrificioInput } from "@/shared/schemas/sacrificio.schema";
import { createSacrificio } from "../api/sacrificios.api";

interface CreateSacrificioArgs {
  readonly input: CreateSacrificioInput;
  readonly loteId: string;
  readonly loteTotal: number;
}

export function useCreateSacrificio(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, loteId, loteTotal }: CreateSacrificioArgs) => {
      if (!orgId) throw new Error("No org_id disponible");
      return createSacrificio(orgId, farmId, input, loteId, loteTotal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sacrificios", farmId] });
      queryClient.invalidateQueries({ queryKey: ["sacrificio"] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
