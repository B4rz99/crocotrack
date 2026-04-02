import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateMortalidadInput } from "@/shared/schemas/mortalidad.schema";

interface MortalidadSizeGroup {
  readonly size_inches: number;
  readonly animal_count: number;
}

export interface MortalidadWithDetails {
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
  readonly mortalidad_size_groups: readonly MortalidadSizeGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getMortalidadesByFarm(farmId: string): Promise<MortalidadWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("mortalidades")
    .select(
      `
      *,
      mortalidad_size_groups ( size_inches, animal_count ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: MortalidadWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.mortalidades
      .where("farm_id")
      .equals(farmId)
      .filter((m) => m.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((m) => ({
      ...m,
      notes: m.notes ?? null,
      created_by: m.created_by ?? null,
      mortalidad_size_groups: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.mortalidades.bulkPut(
    data.map(({ mortalidad_size_groups: _msg, profiles: _p, pools: _pools, ...mort }) => ({
      ...mort,
      notes: mort.notes ?? undefined,
      created_by: mort.created_by ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

export async function createMortalidad(
  orgId: string,
  farmId: string,
  input: CreateMortalidadInput,
  loteId: string
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_event_date: input.event_date,
    p_compositions: input.compositions,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_mortalidad", rpcPayload);

  const totalAnimals = input.compositions.reduce((sum, c) => sum + c.animal_count, 0);

  const localMort = {
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

  await db.mortalidades.put(localMort);

  if (error) {
    await addToOutbox("create_mortalidad", id, "RPC", {
      ...rpcPayload,
      _entity_table: "mortalidades",
    });
  }

  return { id };
}
