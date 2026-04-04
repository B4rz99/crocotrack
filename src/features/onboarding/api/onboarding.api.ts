import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateCleaningProductTypeInput } from "@/shared/schemas/cleaning-product-type.schema";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";
import type { CreateOrgInput } from "@/shared/schemas/org.schema";
import type { CreatePoolInput } from "@/shared/schemas/pool.schema";

interface OnboardingData {
  readonly orgData: CreateOrgInput;
  readonly farmData: { readonly name: string; readonly location?: string };
  readonly foodTypesData: readonly CreateFoodTypeInput[];
  readonly cleaningProductsData: readonly CreateCleaningProductTypeInput[];
  readonly cleaningFrequencyDays: number | null;
  readonly poolsData: readonly CreatePoolInput[];
  readonly incubatorsData: readonly CreateIncubatorInput[];
  readonly inviteEmails: readonly string[];
}

async function batchInsertWithSync(
  tableName: string,
  entries: readonly Record<string, unknown>[],
  now: string,
  toLocal?: (entry: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  if (entries.length === 0) return;

  const { error } = await untypedSupabase.from(tableName).insert(entries);

  if (error) {
    console.error(`[onboarding] ${tableName} batch insert failed:`, error.message, error);
  }

  const syncStatus = error ? "pending" : "synced";
  const localEntries = entries.map((entry) => ({
    ...(toLocal ? toLocal(entry) : entry),
    _sync_status: syncStatus,
    _local_updated_at: now,
  }));
  await db.table(tableName).bulkPut(localEntries);

  if (error) {
    const outboxEntries = entries.map((entry) => ({
      table_name: tableName,
      record_id: entry.id as string,
      operation: "INSERT" as const,
      payload: entry as Record<string, unknown>,
      created_at: now,
      retry_count: 0,
    }));
    await db.sync_outbox.bulkAdd(outboxEntries);
  }
}

export async function submitOnboarding(
  data: OnboardingData,
  orgId: string,
  userId: string
): Promise<void> {
  const now = nowISO();
  const farmId = generateId();

  // 1. Update organization (must complete before batch inserts need org_id)
  const { id: _orgId, ...orgUpdateFields } = {
    id: orgId,
    name: data.orgData.name,
    country: data.orgData.country,
    currency: data.orgData.currency,
    onboarding_completed: true,
    updated_at: now,
  };

  const { error: orgError } = await untypedSupabase
    .from("organizations")
    .update(orgUpdateFields)
    .eq("id", orgId);

  if (orgError) {
    console.error("[onboarding] org update failed:", orgError.message, orgError);
  }

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
    await addToOutbox("organizations", orgId, "UPDATE", { id: orgId, ...orgUpdateFields });
  }

  // 2. Create farm (must complete before pools/incubators need farm_id)
  const farmPayload = {
    id: farmId,
    org_id: orgId,
    name: data.farmData.name,
    location: data.farmData.location ?? null,
    cleaning_frequency_days: data.cleaningFrequencyDays ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error: farmError } = await untypedSupabase.from("farms").insert(farmPayload);

  if (farmError) {
    console.error("[onboarding] farm insert failed:", farmError.message, farmError);
  }

  await db.farms.put({
    ...farmPayload,
    location: farmPayload.location ?? undefined,
    cleaning_frequency_days: farmPayload.cleaning_frequency_days ?? undefined,
    _sync_status: farmError ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (farmError) {
    await addToOutbox("farms", farmId, "INSERT", farmPayload);
  }

  // 3. Batch insert food types, pools, and incubators in parallel
  const foodTypeEntries = data.foodTypesData.map((ft) => ({
    id: generateId(),
    org_id: orgId,
    name: ft.name,
    unit: ft.unit ?? "kg",
    is_default: false,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const cleaningProductEntries = data.cleaningProductsData.map((p) => ({
    id: generateId(),
    org_id: orgId,
    name: p.name,
    is_default: false,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const poolEntries = data.poolsData.map((pool) => ({
    id: generateId(),
    org_id: orgId,
    farm_id: farmId,
    name: pool.name,
    code: pool.code ?? null,
    pool_type: pool.pool_type,
    capacity: pool.capacity ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const incubatorEntries = data.incubatorsData.map((inc) => ({
    id: generateId(),
    org_id: orgId,
    farm_id: farmId,
    name: inc.name,
    capacity: inc.capacity ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  await Promise.all([
    batchInsertWithSync("food_types", foodTypeEntries, now),
    batchInsertWithSync("cleaning_product_types", cleaningProductEntries, now),
    batchInsertWithSync("pools", poolEntries, now, (entry) => ({
      ...entry,
      code: (entry.code as string | null) ?? undefined,
      capacity: (entry.capacity as number | null) ?? undefined,
    })),
    batchInsertWithSync("incubators", incubatorEntries, now, (entry) => ({
      ...entry,
      capacity: (entry.capacity as number | null) ?? undefined,
    })),
  ]);

  if (data.cleaningFrequencyDays !== null) {
    const { error: freqError } = await untypedSupabase
      .from("farms")
      .update({ cleaning_frequency_days: data.cleaningFrequencyDays })
      .eq("id", farmId);

    if (freqError) {
      console.error("[onboarding] cleaning frequency update failed:", freqError.message);
    } else {
      await db.farms.update(farmId, { cleaning_frequency_days: data.cleaningFrequencyDays });
    }
  }

  // 4. Insert invitations individually (best effort, no offline fallback)
  await Promise.all(
    data.inviteEmails.map(async (email) => {
      const { error: inviteError } = await untypedSupabase.from("invitations").insert({
        org_id: orgId,
        email,
        role: "worker",
        farm_ids: [farmId],
        invited_by: userId,
        token: generateId(),
        status: "pending",
      });

      if (inviteError) {
        console.error("[onboarding] invitation insert failed:", inviteError.message, inviteError);
      }
    })
  );
}
