import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateMortalidadInput } from "@/shared/schemas/mortalidad.schema";
import { createMortalidad } from "../api/mortalidad.api";

interface CreateMortalidadArgs {
  readonly orgId: string;
  readonly farmId: string;
  readonly input: CreateMortalidadInput;
  readonly loteId: string;
}

export function useCreateMortalidad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, farmId, input, loteId }: CreateMortalidadArgs) =>
      createMortalidad(orgId, farmId, input, loteId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mortalidades", variables.farmId] });
    },
  });
}
