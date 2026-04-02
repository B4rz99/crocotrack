import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateFoodPurchaseInput } from "@/shared/schemas/alimentacion.schema";
import { createFoodPurchase } from "../api/food-stock.api";

export function useCreateFoodPurchase(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: (input: CreateFoodPurchaseInput) => {
      if (!orgId) throw new Error("No org_id available");
      return createFoodPurchase(orgId, farmId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-purchases", farmId] });
      queryClient.invalidateQueries({ queryKey: ["food-stock", farmId] });
    },
  });
}
