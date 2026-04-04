import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateCleaningPurchaseInput } from "@/shared/schemas/cleaning-purchase.schema";

interface CleaningProductTypeName {
  readonly name: string;
}

export interface CleaningStockWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly cleaning_product_type_id: string;
  readonly current_quantity: number;
  readonly low_stock_threshold: number | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly cleaning_product_types: CleaningProductTypeName | null;
}

export interface CleaningPurchaseWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly cleaning_product_type_id: string;
  readonly purchase_date: string;
  readonly quantity: number;
  readonly supplier: string | null;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly cleaning_product_types: CleaningProductTypeName | null;
  readonly profiles: { readonly full_name: string } | null;
}

export async function getCleaningStockByFarm(farmId: string): Promise<CleaningStockWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("cleaning_product_stock")
    .select("*, cleaning_product_types ( name )")
    .eq("farm_id", farmId)) as {
    data: CleaningStockWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.cleaning_product_stock.where("farm_id").equals(farmId).toArray();
    return local.map((s) => ({
      ...s,
      low_stock_threshold: s.low_stock_threshold ?? null,
      cleaning_product_types: null,
    }));
  }

  const now = nowISO();
  await db.cleaning_product_stock.bulkPut(
    data.map(({ cleaning_product_types: _cpt, ...stock }) => ({
      ...stock,
      low_stock_threshold: stock.low_stock_threshold ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function getCleaningPurchasesByFarm(
  farmId: string
): Promise<CleaningPurchaseWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("cleaning_product_purchases")
    .select("*, cleaning_product_types ( name ), profiles ( full_name )")
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("purchase_date", { ascending: false })) as {
    data: CleaningPurchaseWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.cleaning_product_purchases
      .where("farm_id")
      .equals(farmId)
      .filter((p) => p.is_active)
      .reverse()
      .sortBy("purchase_date");
    return local.map((p) => ({
      ...p,
      supplier: p.supplier ?? null,
      notes: p.notes ?? null,
      created_by: p.created_by ?? null,
      cleaning_product_types: null,
      profiles: null,
    }));
  }

  const now = nowISO();
  await db.cleaning_product_purchases.bulkPut(
    data.map(({ cleaning_product_types: _cpt, profiles: _p, ...purchase }) => ({
      ...purchase,
      supplier: purchase.supplier ?? undefined,
      notes: purchase.notes ?? undefined,
      created_by: purchase.created_by ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function createCleaningPurchase(
  orgId: string,
  farmId: string,
  input: CreateCleaningPurchaseInput
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_cleaning_product_type_id: input.cleaning_product_type_id,
    p_purchase_date: input.purchase_date,
    p_quantity: input.quantity,
    p_supplier: input.supplier ?? null,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_cleaning_product_purchase", rpcPayload);

  const localPurchase = {
    id,
    org_id: orgId,
    farm_id: farmId,
    cleaning_product_type_id: input.cleaning_product_type_id,
    purchase_date: input.purchase_date,
    quantity: input.quantity,
    supplier: input.supplier,
    notes: input.notes,
    is_active: true,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.cleaning_product_purchases.put(localPurchase);

  if (error) {
    await addToOutbox("create_cleaning_product_purchase", id, "RPC", {
      ...rpcPayload,
      _entity_table: "cleaning_product_purchases",
    });
  }

  return { id };
}
