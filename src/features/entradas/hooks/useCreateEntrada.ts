import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateEntradaInput } from "@/shared/schemas/entrada.schema";
import { createEntrada } from "../api/entradas.api";

interface CreateEntradaArgs {
  readonly input: CreateEntradaInput;
  readonly avalFile?: File;
}

export function useCreateEntrada(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, avalFile }: CreateEntradaArgs) => {
      if (!orgId) throw new Error("No org_id available");
      return createEntrada(orgId, farmId, input, avalFile);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["entradas", farmId] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });

      if (
        variables.input.origin_type === "finca_propia" &&
        variables.input.origin_farm_id !== farmId
      ) {
        queryClient.invalidateQueries({
          queryKey: ["pools", variables.input.origin_farm_id],
        });
      }
    },
  });
}
