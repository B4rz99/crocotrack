import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateLimpiezaInput } from "@/shared/schemas/limpieza.schema";

interface LimpiezaProductDetail {
  readonly cleaning_product_type_id: string;
  readonly quantity: number;
  readonly cleaning_product_types: { readonly name: string } | null;
}

export interface LimpiezaWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly event_date: string;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly limpieza_products: readonly LimpiezaProductDetail[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getLimpiezasByFarm(farmId: string): Promise<LimpiezaWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("limpiezas")
    .select(
      `
      *,
      limpieza_products ( cleaning_product_type_id, quantity, cleaning_product_types ( name ) ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: LimpiezaWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.limpiezas
      .where("farm_id")
      .equals(farmId)
      .filter((l) => l.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((l) => ({
      ...l,
      notes: l.notes ?? null,
      created_by: l.created_by ?? null,
      limpieza_products: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.limpiezas.bulkPut(
    data.map(({ limpieza_products: _lp, profiles: _p, pools: _pools, ...limpieza }) => ({
      ...limpieza,
      notes: limpieza.notes ?? undefined,
      created_by: limpieza.created_by ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function createLimpieza(
  orgId: string,
  farmId: string,
  input: CreateLimpiezaInput
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_event_date: input.event_date,
    p_products: input.products,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_limpieza", rpcPayload);

  const localLimpieza = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    event_date: input.event_date,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.limpiezas.put(localLimpieza);

  if (error) {
    await addToOutbox("create_limpieza", id, "RPC", {
      ...rpcPayload,
      _entity_table: "limpiezas",
    });
  }

  return { id };
}
