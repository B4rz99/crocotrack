import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateTrasladoInput } from "@/shared/schemas/traslado.schema";

interface TrasladoSizeGroup {
  readonly size_inches: number;
  readonly animal_count: number;
}

export interface TrasladoWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly destination_pool_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly traslado_size_groups: readonly TrasladoSizeGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly origin_pool: { readonly name: string } | null;
  readonly destination_pool: { readonly name: string } | null;
}

export async function getTrasladosByFarm(farmId: string): Promise<TrasladoWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("traslados")
    .select(
      `
      *,
      traslado_size_groups ( size_inches, animal_count ),
      profiles ( full_name ),
      origin_pool:pools!traslados_pool_id_fkey ( name ),
      destination_pool:pools!traslados_destination_pool_id_fkey ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: TrasladoWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.traslados
      .where("farm_id")
      .equals(farmId)
      .filter((t) => t.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((t) => ({
      ...t,
      notes: t.notes ?? null,
      created_by: t.created_by ?? null,
      traslado_size_groups: [],
      profiles: null,
      origin_pool: null,
      destination_pool: null,
    }));
  }

  const now = nowISO();
  await db.traslados.bulkPut(
    data.map(
      ({
        traslado_size_groups: _tsg,
        profiles: _p,
        origin_pool: _op,
        destination_pool: _dp,
        ...traslado
      }) => ({
        ...traslado,
        notes: traslado.notes ?? undefined,
        created_by: traslado.created_by ?? undefined,
        _sync_status: "synced" as const,
        _local_updated_at: now,
      })
    )
  );

  return data;
}

export async function createTraslado(
  orgId: string,
  farmId: string,
  input: CreateTrasladoInput,
  loteId: string
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_destination_pool_id: input.destination_pool_id,
    p_event_date: input.event_date,
    p_compositions: input.compositions,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_traslado", rpcPayload);

  const totalAnimals = input.compositions.reduce((sum, c) => sum + c.animal_count, 0);

  const localTraslado = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    lote_id: loteId,
    destination_pool_id: input.destination_pool_id,
    event_date: input.event_date,
    total_animals: totalAnimals,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.traslados.put(localTraslado);

  if (error) {
    await addToOutbox("create_traslado", id, "RPC", {
      ...rpcPayload,
      _entity_table: "traslados",
    });
  }

  return { id };
}
