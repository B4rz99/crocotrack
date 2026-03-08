import Dexie, { type Table } from "dexie";

type SyncStatus = "synced" | "pending" | "conflict";

interface SyncMeta {
  readonly _sync_status: SyncStatus;
  readonly _local_updated_at: string;
  readonly _server_updated_at?: string;
}

export interface LocalOrganization extends SyncMeta {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly country: string;
  readonly currency: string;
  readonly settings: Record<string, unknown>;
  readonly onboarding_completed: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalFarm extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly location?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalPool extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly name: string;
  readonly code?: string;
  readonly pool_type: "crianza" | "reproductor";
  readonly capacity?: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalIncubator extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly name: string;
  readonly capacity?: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalFoodType extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly unit: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SyncOutboxEntry {
  readonly id?: number;
  readonly table_name: string;
  readonly record_id: string;
  readonly operation: "INSERT" | "UPDATE" | "DELETE";
  readonly payload: Record<string, unknown>;
  readonly created_at: string;
  readonly retry_count: number;
}

class CrocoTrackDB extends Dexie {
  organizations!: Table<LocalOrganization>;
  farms!: Table<LocalFarm>;
  pools!: Table<LocalPool>;
  incubators!: Table<LocalIncubator>;
  food_types!: Table<LocalFoodType>;
  sync_outbox!: Table<SyncOutboxEntry>;

  constructor() {
    super("crocotrack");
    this.version(1).stores({
      organizations: "id, _sync_status",
      farms: "id, org_id, _sync_status",
      pools: "id, org_id, farm_id, _sync_status",
      incubators: "id, org_id, farm_id, _sync_status",
      food_types: "id, org_id, _sync_status",
      sync_outbox: "++id, table_name, record_id",
    });
  }
}

export const db = new CrocoTrackDB();
