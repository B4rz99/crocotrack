import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { nowISO } from "@/shared/lib/utils";

export interface CleaningProductType {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export async function getCleaningProductTypes(): Promise<CleaningProductType[]> {
  const { data, error } = (await untypedSupabase
    .from("cleaning_product_types")
    .select("*")
    .eq("is_active", true)
    .order("name")) as {
    data: CleaningProductType[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.cleaning_product_types.filter((t) => t.is_active).sortBy("name");
    return local;
  }

  const now = nowISO();
  await db.cleaning_product_types.bulkPut(
    data.map((t) => ({
      ...t,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}
