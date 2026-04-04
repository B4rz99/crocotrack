import { db, type LocalSacrificio, type LocalSacrificioSizeGroup } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateSacrificioInput } from "@/shared/schemas/sacrificio.schema";

interface SacrificioSizeGroup {
  readonly group_type: "sacrificado" | "rechazado";
  readonly size_inches: number;
  readonly animal_count: number;
  readonly destination_pool_id: string | null;
}

export interface SacrificioWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly total_sacrificed: number;
  readonly total_rejected: number;
  readonly total_faltantes: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  readonly sacrificio_size_groups: readonly SacrificioSizeGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getSacrificiosByFarm(farmId: string): Promise<SacrificioWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("sacrificios")
    .select(
      `
      *,
      sacrificio_size_groups ( group_type, size_inches, animal_count, destination_pool_id ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("event_date", { ascending: false })) as {
    data: SacrificioWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.sacrificios
      .where("farm_id")
      .equals(farmId)
      .filter((s) => s.is_active)
      .reverse()
      .sortBy("event_date");
    return local.map((s) => ({
      ...s,
      notes: s.notes ?? null,
      created_by: s.created_by ?? null,
      sacrificio_size_groups: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.sacrificios.bulkPut(
    data.map(({ sacrificio_size_groups: _sg, profiles: _p, pools: _pools, ...sacrificio }) => ({
      ...sacrificio,
      notes: sacrificio.notes ?? undefined,
      created_by: sacrificio.created_by ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

function sacrificioFromLocal(
  row: LocalSacrificio,
  groups: readonly LocalSacrificioSizeGroup[]
): SacrificioWithDetails {
  return {
    id: row.id,
    org_id: row.org_id,
    farm_id: row.farm_id,
    pool_id: row.pool_id,
    lote_id: row.lote_id,
    event_date: row.event_date,
    total_animals: row.total_animals,
    total_sacrificed: row.total_sacrificed,
    total_rejected: row.total_rejected,
    total_faltantes: row.total_faltantes,
    notes: row.notes ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    sacrificio_size_groups: groups.map((g) => ({
      group_type: g.group_type,
      size_inches: g.size_inches,
      animal_count: g.animal_count,
      destination_pool_id: g.destination_pool_id ?? null,
    })),
    profiles: null,
    pools: null,
  };
}

export async function getSacrificioById(
  id: string,
  farmId: string
): Promise<SacrificioWithDetails | null> {
  const { data, error } = (await untypedSupabase
    .from("sacrificios")
    .select(
      `
      *,
      sacrificio_size_groups ( group_type, size_inches, animal_count, destination_pool_id ),
      profiles ( full_name ),
      pools!pool_id ( name )
    `
    )
    .eq("id", id)
    .eq("farm_id", farmId)
    .maybeSingle()) as {
    data: SacrificioWithDetails | null;
    error: { message: string } | null;
  };

  if (data) {
    const now = nowISO();
    const { sacrificio_size_groups: _sg, profiles: _p, pools: _pools, ...sacrificio } = data;
    await db.sacrificios.put({
      ...sacrificio,
      notes: sacrificio.notes ?? undefined,
      created_by: sacrificio.created_by ?? undefined,
      _sync_status: "synced",
      _local_updated_at: now,
    });
    return data;
  }

  if (!error) return null;

  const localRow = await db.sacrificios.get(id);
  if (!localRow || localRow.farm_id !== farmId || !localRow.is_active) return null;

  const localGroups = await db.sacrificio_size_groups.where("sacrificio_id").equals(id).toArray();

  return sacrificioFromLocal(localRow, localGroups);
}

export async function createSacrificio(
  orgId: string,
  farmId: string,
  input: CreateSacrificioInput,
  loteId: string,
  loteTotal: number
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  const pSacrificed = input.groups
    .filter((g) => g.sacrificed_count > 0)
    .map((g) => ({ size_inches: g.size_inches, animal_count: g.sacrificed_count }));

  const pRejected = input.groups.flatMap((g) =>
    g.rejected.map((r) => ({
      size_inches: g.size_inches,
      animal_count: r.animal_count,
      destination_pool_id: r.destination_pool_id,
    }))
  );

  const totalSacrificed = pSacrificed.reduce((sum, s) => sum + s.animal_count, 0);
  const totalRejected = pRejected.reduce((sum, r) => sum + r.animal_count, 0);
  const totalFaltantes = loteTotal - (totalSacrificed + totalRejected);

  const rpcPayload = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_event_date: input.event_date,
    p_sacrificed: pSacrificed,
    p_rejected: pRejected,
    p_notes: input.notes ?? null,
  };

  const { error } = await untypedSupabase.rpc("create_sacrificio", rpcPayload);

  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  if (error && isOnline) {
    throw new Error(error.message);
  }

  const localSacrificio = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    lote_id: loteId,
    event_date: input.event_date,
    total_animals: loteTotal,
    total_sacrificed: totalSacrificed,
    total_rejected: totalRejected,
    total_faltantes: totalFaltantes,
    is_active: true,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.sacrificios.put(localSacrificio);

  if (error) {
    await addToOutbox("create_sacrificio", id, "RPC", {
      ...rpcPayload,
      _entity_table: "sacrificios",
    });
  }

  return { id };
}
