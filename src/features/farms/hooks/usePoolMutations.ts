import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreatePoolInput, UpdatePoolInput } from "@/shared/schemas/pool.schema";
import { createPool, deletePool, updatePool } from "../api/pools.api";

export function useCreatePool(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: (input: CreatePoolInput) => createPool(profile!.org_id, farmId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}

export function useUpdatePool(farmId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, input }: { poolId: string; input: UpdatePoolInput }) =>
      updatePool(poolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}

export function useDeletePool(farmId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (poolId: string) => deletePool(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
