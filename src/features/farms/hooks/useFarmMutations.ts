import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateFarmInput, UpdateFarmInput } from "@/shared/schemas/farm.schema";
import { createFarm, deleteFarm, updateFarm } from "../api/farms.api";

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: (input: CreateFarmInput) => createFarm(profile?.org_id as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ farmId, input }: { farmId: string; input: UpdateFarmInput }) =>
      updateFarm(farmId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}

export function useDeleteFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmId: string) => deleteFarm(farmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}
