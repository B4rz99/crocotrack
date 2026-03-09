import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/shared/lib/db";
import { supabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";
import type { CreateOrgInput } from "@/shared/schemas/org.schema";
import type { CreatePoolInput } from "@/shared/schemas/pool.schema";

interface OnboardingData {
  readonly orgData: CreateOrgInput;
  readonly farmData: { readonly name: string; readonly location?: string };
  readonly foodTypesData: readonly CreateFoodTypeInput[];
  readonly poolsData: readonly CreatePoolInput[];
  readonly incubatorsData: readonly CreateIncubatorInput[];
  readonly inviteEmails: readonly string[];
}

const generateId = (): string => crypto.randomUUID();

const nowISO = (): string => new Date().toISOString();

// Use an untyped client reference for dynamic operations, matching sync.ts pattern
const untypedClient = supabase as unknown as SupabaseClient;

export async function submitOnboarding(
  data: OnboardingData,
  orgId: string,
  userId: string,
): Promise<void> {
  const now = nowISO();
  const farmId = generateId();

  // 1. Update organization
  const orgPayload = {
    id: orgId,
    name: data.orgData.name,
    country: data.orgData.country,
    currency: data.orgData.currency,
    onboarding_completed: true,
    updated_at: now,
  };

  const { error: orgError } = await untypedClient
    .from("organizations")
    .update({
      name: data.orgData.name,
      country: data.orgData.country,
      currency: data.orgData.currency,
      onboarding_completed: true,
      updated_at: now,
    })
    .eq("id", orgId);

  const orgSlug = data.orgData.name.toLowerCase().replace(/\s+/g, "-");

  await db.organizations.put({
    id: orgId,
    name: data.orgData.name,
    slug: orgSlug,
    country: data.orgData.country,
    currency: data.orgData.currency,
    settings: {},
    onboarding_completed: true,
    created_at: now,
    updated_at: now,
    _sync_status: orgError ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (orgError) {
    await addToOutbox("organizations", orgId, "UPDATE", orgPayload);
  }

  // 2. Create farm
  const farmPayload = {
    id: farmId,
    org_id: orgId,
    name: data.farmData.name,
    location: data.farmData.location ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error: farmError } = await untypedClient.from("farms").insert(farmPayload);

  await db.farms.put({
    ...farmPayload,
    location: farmPayload.location ?? undefined,
    _sync_status: farmError ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (farmError) {
    await addToOutbox("farms", farmId, "INSERT", farmPayload);
  }

  // 3. Create food types
  for (const ft of data.foodTypesData) {
    const ftId = generateId();
    const ftPayload = {
      id: ftId,
      org_id: orgId,
      name: ft.name,
      unit: ft.unit ?? "kg",
      is_default: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { error: ftError } = await untypedClient.from("food_types").insert(ftPayload);

    await db.food_types.put({
      ...ftPayload,
      _sync_status: ftError ? "pending" : "synced",
      _local_updated_at: now,
    });

    if (ftError) {
      await addToOutbox("food_types", ftId, "INSERT", ftPayload);
    }
  }

  // 4. Create pools
  for (const pool of data.poolsData) {
    const poolId = generateId();
    const poolPayload = {
      id: poolId,
      org_id: orgId,
      farm_id: farmId,
      name: pool.name,
      code: pool.code ?? null,
      pool_type: pool.pool_type,
      capacity: pool.capacity ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { error: poolError } = await untypedClient.from("pools").insert(poolPayload);

    await db.pools.put({
      ...poolPayload,
      code: poolPayload.code ?? undefined,
      capacity: poolPayload.capacity ?? undefined,
      _sync_status: poolError ? "pending" : "synced",
      _local_updated_at: now,
    });

    if (poolError) {
      await addToOutbox("pools", poolId, "INSERT", poolPayload);
    }
  }

  // 5. Create incubators
  for (const inc of data.incubatorsData) {
    const incId = generateId();
    const incPayload = {
      id: incId,
      org_id: orgId,
      farm_id: farmId,
      name: inc.name,
      capacity: inc.capacity ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { error: incError } = await untypedClient.from("incubators").insert(incPayload);

    await db.incubators.put({
      ...incPayload,
      capacity: incPayload.capacity ?? undefined,
      _sync_status: incError ? "pending" : "synced",
      _local_updated_at: now,
    });

    if (incError) {
      await addToOutbox("incubators", incId, "INSERT", incPayload);
    }
  }

  // 6. Send invitations (best effort, no offline fallback for invites)
  for (const email of data.inviteEmails) {
    await untypedClient.from("invitations").insert({
      org_id: orgId,
      email,
      role: "worker",
      farm_ids: [farmId],
      invited_by: userId,
      token: generateId(),
      status: "pending",
    });
  }
}
