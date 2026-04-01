import { db } from "@/shared/lib/db";
import { supabase, untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreatePoolInput, UpdatePoolInput } from "@/shared/schemas/pool.schema";

interface LoteSizeComposition {
  readonly size_inches: number;
  readonly animal_count: number;
}

interface ActiveLote {
  readonly id: string;
  readonly status: string;
  readonly opened_at: string;
  readonly lote_size_compositions: readonly LoteSizeComposition[];
}

export interface PoolWithLotes {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly name: string;
  readonly code: string | null;
  readonly pool_type: "crianza" | "reproductor";
  readonly capacity: number | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly lotes: readonly ActiveLote[];
}

export async function getPoolsByFarm(farmId: string) {
  // Uses untypedSupabase because lotes/lote_size_compositions are not in
  // generated types until the 00002_lotes migration is applied and types regenerated.
  // idx_lotes_one_active_per_pool enforces at most one active lote per pool,
  // so lotes[0] is always the correct active lote when present.
  const { data, error } = (await untypedSupabase
    .from("pools")
    .select(
      `
      *,
      lotes (
        id, status, opened_at,
        lote_size_compositions ( size_inches, animal_count )
      )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .eq("lotes.status", "activo")
    .order("name")) as { data: PoolWithLotes[] | null; error: { message: string } | null };

  if (error || !data) {
    const local = await db.pools
      .where("farm_id")
      .equals(farmId)
      .filter((p) => p.is_active)
      .sortBy("name");
    // Normalize to PoolWithLotes shape so callers don't need type narrowing
    return local.map((p) => ({
      ...p,
      code: p.code ?? null,
      capacity: p.capacity ?? null,
      lotes: [] as readonly ActiveLote[],
    }));
  }

  const now = nowISO();
  await db.pools.bulkPut(
    data.map(({ lotes: _lotes, ...pool }) => ({
      ...pool,
      code: pool.code ?? undefined,
      capacity: pool.capacity ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  const remoteIds = new Set(data.map((p) => p.id));
  const localPools = await db.pools
    .where("farm_id")
    .equals(farmId)
    .filter((p) => p.is_active && p._sync_status !== "pending" && !remoteIds.has(p.id))
    .toArray();
  if (localPools.length > 0) {
    await db.pools.bulkUpdate(
      localPools.map((p) => ({ key: p.id, changes: { is_active: false } }))
    );
  }

  return data;
}

export async function createPool(orgId: string, farmId: string, input: CreatePoolInput) {
  const id = generateId();
  const now = nowISO();
  const payload = {
    id,
    org_id: orgId,
    farm_id: farmId,
    name: input.name,
    code: input.code ?? null,
    pool_type: input.pool_type,
    capacity: input.capacity,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("pools").insert(payload);
  const syncStatus = error ? "pending" : "synced";

  await db.pools.put({
    ...payload,
    code: payload.code ?? undefined,
    capacity: payload.capacity ?? undefined,
    _sync_status: syncStatus,
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", id, "INSERT", payload);
  }

  return { id };
}

export async function updatePool(poolId: string, input: UpdatePoolInput) {
  const now = nowISO();
  const updates = {
    name: input.name,
    code: input.code ?? null,
    pool_type: input.pool_type,
    capacity: input.capacity,
    updated_at: now,
  };

  const { error } = await supabase.from("pools").update(updates).eq("id", poolId);

  await db.pools.update(poolId, {
    ...updates,
    code: updates.code ?? undefined,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", poolId, "UPDATE", { id: poolId, ...updates });
  }
}

const ACTIVE_LOTE_ERROR =
  "Esta pileta tiene un lote activo. Cierre el lote antes de desactivar la pileta.";

export async function deletePool(poolId: string) {
  // Pre-deletion guard: check for active lotes
  // Uses untypedSupabase — lotes table not in generated types yet.
  const { data: activeLotes, error: guardError } = (await untypedSupabase
    .from("lotes")
    .select("id")
    .eq("pool_id", poolId)
    .eq("status", "activo")
    .limit(1)) as { data: { id: string }[] | null; error: { message: string } | null };

  if (guardError) {
    // Offline fallback: check Dexie for active lotes
    const localActiveLotes = await db.lotes
      .where("pool_id")
      .equals(poolId)
      .filter((l) => l.status === "activo")
      .limit(1)
      .toArray();
    if (localActiveLotes.length > 0) {
      throw new Error(ACTIVE_LOTE_ERROR);
    }
  } else if (activeLotes && activeLotes.length > 0) {
    throw new Error(ACTIVE_LOTE_ERROR);
  }

  const now = nowISO();

  const { error } = await supabase
    .from("pools")
    .update({ is_active: false, updated_at: now })
    .eq("id", poolId);

  await db.pools.update(poolId, {
    is_active: false,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", poolId, "UPDATE", {
      id: poolId,
      is_active: false,
      updated_at: now,
    });
  }
}
