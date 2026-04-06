import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateCleaningPurchaseInput } from "@/shared/schemas/cleaning-purchase.schema";
import { createCleaningPurchase } from "../api/cleaning-stock.api";

export function useCreateCleaningPurchase(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useMutation({
    mutationFn: (input: CreateCleaningPurchaseInput) => {
      if (!orgId) throw new Error("No org_id available");
      return createCleaningPurchase(orgId, farmId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cleaning-stock", farmId] });
      queryClient.invalidateQueries({ queryKey: ["cleaning-purchases", farmId] });
    },
  });
}
