import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateMortalidadInput } from "@/shared/schemas/mortalidad.schema";
import { createMortalidad } from "../api/mortalidad.api";

interface CreateMortalidadArgs {
  readonly input: CreateMortalidadInput;
  readonly loteId: string;
}

export function useCreateMortalidad(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, loteId }: CreateMortalidadArgs) => {
      if (!orgId) throw new Error("No org_id available");
      return createMortalidad(orgId, farmId, input, loteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mortalidades", farmId] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
