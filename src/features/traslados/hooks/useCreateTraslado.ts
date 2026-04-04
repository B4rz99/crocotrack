import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateTrasladoInput } from "@/shared/schemas/traslado.schema";
import { createTraslado } from "../api/traslados.api";

interface CreateTrasladoArgs {
  readonly input: CreateTrasladoInput;
  readonly loteId: string;
}

export function useCreateTraslado(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, loteId }: CreateTrasladoArgs) => {
      if (!orgId) throw new Error("No org_id available");
      return createTraslado(orgId, farmId, input, loteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traslados", farmId] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
