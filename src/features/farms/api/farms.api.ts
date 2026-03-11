import { db } from "@/shared/lib/db";
import { supabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import type { CreateFarmInput, UpdateFarmInput } from "@/shared/schemas/farm.schema";

const generateId = (): string => crypto.randomUUID();
const nowISO = (): string => new Date().toISOString();

export async function getFarms(orgId: string) {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    const local = await db.farms
      .where("org_id")
      .equals(orgId)
      .filter((f) => f.is_active)
      .sortBy("name");
    return local;
  }

  const now = nowISO();
  await db.farms.bulkPut(
    data.map((farm) => ({
      ...farm,
      location: farm.location ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    })),
  );

  return data;
}

export async function getFarmById(farmId: string) {
  const { data, error } = await supabase.from("farms").select("*").eq("id", farmId).single();

  if (error) {
    const local = await db.farms.get(farmId);
    return local ?? null;
  }

  const now = nowISO();
  await db.farms.put({
    ...data,
    location: data.location ?? undefined,
    _sync_status: "synced",
    _local_updated_at: now,
  });

  return data;
}

export async function createFarm(orgId: string, input: CreateFarmInput) {
  const id = generateId();
  const now = nowISO();
  const payload = {
    id,
    org_id: orgId,
    name: input.name,
    location: input.location ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("farms").insert(payload);
  const syncStatus = error ? "pending" : "synced";

  await db.farms.put({
    ...payload,
    location: payload.location ?? undefined,
    _sync_status: syncStatus,
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", id, "INSERT", payload);
  }

  return { id };
}

export async function updateFarm(farmId: string, input: UpdateFarmInput) {
  const now = nowISO();
  const updates = {
    name: input.name,
    location: input.location ?? null,
    updated_at: now,
  };

  const { error } = await supabase.from("farms").update(updates).eq("id", farmId);

  await db.farms.update(farmId, {
    ...updates,
    location: updates.location ?? undefined,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", farmId, "UPDATE", { id: farmId, ...updates });
  }
}

export async function deleteFarm(farmId: string) {
  const now = nowISO();

  const { error } = await supabase
    .from("farms")
    .update({ is_active: false, updated_at: now })
    .eq("id", farmId);

  await db.farms.update(farmId, {
    is_active: false,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", farmId, "UPDATE", {
      id: farmId,
      is_active: false,
      updated_at: now,
    });
  }
}
