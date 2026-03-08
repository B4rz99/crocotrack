import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncOutboxEntry } from "./db";
import { db } from "./db";
import { supabase } from "./supabase";

type SyncOperation = SyncOutboxEntry["operation"];

const SYNCABLE_TABLES = ["organizations", "farms", "pools", "incubators", "food_types"] as const;
type SyncableTable = (typeof SYNCABLE_TABLES)[number];

const isSyncableTable = (name: string): name is SyncableTable =>
  (SYNCABLE_TABLES as readonly string[]).includes(name);

export const addToOutbox = async (
  tableName: string,
  recordId: string,
  operation: SyncOperation,
  payload: Record<string, unknown>,
): Promise<void> => {
  await db.sync_outbox.add({
    table_name: tableName,
    record_id: recordId,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
  });
};

export const getPendingCount = async (): Promise<number> => {
  return db.sync_outbox.count();
};

export const markSynced = async (tableName: string, recordId: string): Promise<void> => {
  if (isSyncableTable(tableName)) {
    await db.table(tableName).update(recordId, { _sync_status: "synced" });
  }
};

interface SupabaseResult {
  error: { message: string } | null;
}

// Use an untyped client reference to allow dynamic table names with arbitrary payloads.
// The sync outbox operates on serialized records where compile-time table typing is not feasible.
const untypedClient = supabase as unknown as SupabaseClient;

const applyOperation = async (entry: SyncOutboxEntry): Promise<SupabaseResult> => {
  if (entry.operation === "DELETE") {
    return untypedClient.from(entry.table_name).delete().eq("id", entry.record_id);
  }

  return untypedClient.from(entry.table_name).upsert(entry.payload);
};

export const flushOutbox = async (): Promise<void> => {
  const entries = await db.sync_outbox.toArray();

  for (const entry of entries) {
    const { error } = await applyOperation(entry);
    const entryId = entry.id;

    if (entryId === undefined) {
      continue;
    }

    if (error) {
      await db.sync_outbox.update(entryId, { retry_count: entry.retry_count + 1 });
    } else {
      await db.sync_outbox.delete(entryId);
      if (entry.operation !== "DELETE") {
        await markSynced(entry.table_name, entry.record_id);
      }
    }
  }
};
