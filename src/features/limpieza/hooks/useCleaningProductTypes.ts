import { useQuery } from "@tanstack/react-query";
import { getCleaningProductTypes } from "../api/cleaning-product-types.api";

export function useCleaningProductTypes() {
  return useQuery({
    queryKey: ["cleaning-product-types"],
    queryFn: getCleaningProductTypes,
  });
}
