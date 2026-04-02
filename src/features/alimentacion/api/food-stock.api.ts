import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateFoodPurchaseInput } from "@/shared/schemas/alimentacion.schema";

export interface FoodStockWithType {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly food_type_id: string;
  readonly current_quantity: number;
  readonly low_stock_threshold: number | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly food_types: { readonly name: string; readonly unit: string } | null;
}

export interface FoodPurchaseWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly food_type_id: string;
  readonly purchase_date: string;
  readonly quantity_kg: number;
  readonly supplier: string | null;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly food_types: { readonly name: string; readonly unit: string } | null;
  readonly profiles: { readonly full_name: string } | null;
}

export async function getFoodStockByFarm(farmId: string): Promise<FoodStockWithType[]> {
  const { data, error } = (await untypedSupabase
    .from("food_stock")
    .select(
      `
      *,
      food_types ( name, unit )
    `
    )
    .eq("farm_id", farmId)
    .order("created_at")) as {
    data: FoodStockWithType[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.food_stock.where("farm_id").equals(farmId).sortBy("created_at");
    return local.map((s) => ({
      ...s,
      low_stock_threshold: s.low_stock_threshold ?? null,
      food_types: null,
    }));
  }

  const now = nowISO();
  await db.food_stock.bulkPut(
    data.map(({ food_types: _ft, ...stock }) => ({
      ...stock,
      low_stock_threshold: stock.low_stock_threshold ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function getFoodPurchasesByFarm(farmId: string): Promise<FoodPurchaseWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("food_purchases")
    .select(
      `
      *,
      food_types ( name, unit ),
      profiles ( full_name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("purchase_date", { ascending: false })) as {
    data: FoodPurchaseWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.food_purchases
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
      food_types: null,
      profiles: null,
    }));
  }

  const now = nowISO();
  await db.food_purchases.bulkPut(
    data.map(({ food_types: _ft, profiles: _p, ...purchase }) => ({
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

export async function createFoodPurchase(
  orgId: string,
  farmId: string,
  input: CreateFoodPurchaseInput
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_food_type_id: input.food_type_id,
    p_purchase_date: input.purchase_date,
    p_quantity_kg: input.quantity_kg,
    p_supplier: input.supplier ?? null,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_food_purchase", rpcPayload);

  const localPurchase = {
    id,
    org_id: orgId,
    farm_id: farmId,
    food_type_id: input.food_type_id,
    purchase_date: input.purchase_date,
    quantity_kg: input.quantity_kg,
    supplier: input.supplier,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.food_purchases.put(localPurchase);

  if (error) {
    await addToOutbox("create_food_purchase", id, "RPC", {
      ...rpcPayload,
      _entity_table: "food_purchases",
    });
  }

  return { id };
}
