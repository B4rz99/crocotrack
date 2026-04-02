import { useQuery } from "@tanstack/react-query";
import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import type { FoodType } from "../types";

type FoodTypeRow = FoodType & { readonly is_active: boolean };

async function getFoodTypes(): Promise<FoodType[]> {
  const { data, error } = (await untypedSupabase
    .from("food_types")
    .select("id, name, unit, is_active")
    .eq("is_active", true)
    .order("name")) as {
    data: FoodTypeRow[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    // Fallback to Dexie — food_types are seeded during onboarding
    const local = await db.food_types.filter((ft) => ft.is_active).sortBy("name");
    return local.map((ft) => ({ id: ft.id, name: ft.name, unit: ft.unit }));
  }

  // Do NOT bulkPut here — food_types are owned by the onboarding flow in Dexie
  // and already have complete records. Overwriting with partial data (no org_id) would corrupt them.
  return data;
}

export function useFoodTypes() {
  return useQuery({
    queryKey: ["food-types"],
    queryFn: getFoodTypes,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
