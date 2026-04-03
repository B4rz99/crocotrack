import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateClasificacionInput } from "@/shared/schemas/clasificacion.schema";

interface ClasificacionGroup {
  readonly size_inches: number;
  readonly animal_count: number;
  readonly destination_pool_id: string;
}

export interface ClasificacionWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly clasificacion_groups: readonly ClasificacionGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getClasificacionesByFarm(
  farmId: string
): Promise<ClasificacionWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("clasificaciones")
    .select(
      `
      *,
      clasificacion_groups ( size_inches, animal_count, destination_pool_id ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: ClasificacionWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.clasificaciones
      .where("farm_id")
      .equals(farmId)
      .filter((c) => c.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((c) => ({
      ...c,
      notes: c.notes ?? null,
      created_by: c.created_by ?? null,
      clasificacion_groups: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.clasificaciones.bulkPut(
    data.map(
      ({ clasificacion_groups: _cg, profiles: _p, pools: _pools, ...clas }) => ({
        ...clas,
        notes: clas.notes ?? undefined,
        created_by: clas.created_by ?? undefined,
        _sync_status: "synced" as const,
        _local_updated_at: now,
      })
    )
  );

  return data;
}

export async function createClasificacion(
  orgId: string,
  farmId: string,
  input: CreateClasificacionInput,
  loteId: string
): Promise<{ id: string; pending: boolean }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_event_date: input.event_date,
    p_compositions: input.groups,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_clasificacion", rpcPayload);

  const totalAnimals = input.groups.reduce((sum, g) => sum + g.animal_count, 0);

  const localClasificacion = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    lote_id: loteId,
    event_date: input.event_date,
    total_animals: totalAnimals,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.clasificaciones.put(localClasificacion);

  if (error) {
    await addToOutbox("create_clasificacion", id, "RPC", {
      ...rpcPayload,
      _entity_table: "clasificaciones",
    });
  }

  return { id, pending: !!error };
}
