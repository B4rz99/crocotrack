import { db } from "@/shared/lib/db";
import { supabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import type { CreatePoolInput, UpdatePoolInput } from "@/shared/schemas/pool.schema";

const generateId = (): string => crypto.randomUUID();
const nowISO = (): string => new Date().toISOString();

export async function getPoolsByFarm(farmId: string) {
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    const local = await db.pools
      .where("farm_id")
      .equals(farmId)
      .filter((p) => p.is_active)
      .sortBy("name");
    return local;
  }

  const now = nowISO();
  await db.pools.bulkPut(
    data.map((pool) => ({
      ...pool,
      code: pool.code ?? undefined,
      capacity: pool.capacity ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    })),
  );

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

export async function deletePool(poolId: string) {
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
