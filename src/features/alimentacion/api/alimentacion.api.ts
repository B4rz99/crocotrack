import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateAlimentacionInput } from "@/shared/schemas/alimentacion.schema";

export interface AlimentacionWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string | null;
  readonly food_type_id: string;
  readonly event_date: string;
  readonly quantity_kg: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly food_types: { readonly name: string; readonly unit: string } | null;
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getAlimentacionesByFarm(farmId: string): Promise<AlimentacionWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("alimentaciones")
    .select(
      `
      *,
      food_types ( name, unit ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: AlimentacionWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.alimentaciones
      .where("farm_id")
      .equals(farmId)
      .filter((a) => a.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((a) => ({
      ...a,
      lote_id: a.lote_id ?? null,
      notes: a.notes ?? null,
      created_by: a.created_by ?? null,
      food_types: null,
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.alimentaciones.bulkPut(
    data.map(({ food_types: _ft, profiles: _p, pools: _pools, ...alim }) => ({
      ...alim,
      lote_id: alim.lote_id ?? undefined,
      notes: alim.notes ?? undefined,
      created_by: alim.created_by ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function createAlimentacion(
  orgId: string,
  farmId: string,
  input: CreateAlimentacionInput
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_food_type_id: input.food_type_id,
    p_event_date: input.event_date,
    p_quantity_kg: input.quantity_kg,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_alimentacion", rpcPayload);

  const localAlim = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    food_type_id: input.food_type_id,
    event_date: input.event_date,
    quantity_kg: input.quantity_kg,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.alimentaciones.put(localAlim);

  if (error) {
    await addToOutbox("create_alimentacion", id, "RPC", {
      ...rpcPayload,
      _entity_table: "alimentaciones",
    });
  }

  return { id };
}
