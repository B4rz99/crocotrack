import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateClasificacionInput } from "@/shared/schemas/clasificacion.schema";
import { createClasificacion } from "../api/clasificacion.api";

interface CreateClasificacionArgs {
  readonly input: CreateClasificacionInput;
  readonly loteId: string;
}

export function useCreateClasificacion(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: ({ input, loteId }: CreateClasificacionArgs) => {
      if (!orgId) throw new Error("No org_id disponible");
      return createClasificacion(orgId, farmId, input, loteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clasificaciones", farmId] });
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
