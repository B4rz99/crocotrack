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

export interface LocalLote extends SyncMeta {
  readonly id: string;
  readonly pool_id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly status: "activo" | "cerrado";
  readonly opened_at: string;
  readonly closed_at?: string;
  readonly created_by?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalLoteSizeComposition extends SyncMeta {
  readonly id: string;
  readonly lote_id: string;
  readonly size_inches: number;
  readonly animal_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalEntrada extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly origin_type: "proveedor_persona" | "proveedor_empresa" | "finca_propia" | "incubador";
  readonly entry_date: string;
  readonly total_animals: number;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  // Proveedor persona
  readonly persona_full_name?: string;
  readonly persona_document_id?: string;
  readonly persona_aval_code?: string;
  readonly persona_aval_file_path?: string;
  // Proveedor empresa
  readonly empresa_name?: string;
  readonly empresa_legal_rep?: string;
  readonly empresa_nit?: string;
  readonly empresa_aval_code?: string;
  readonly empresa_aval_file_path?: string;
  // Finca propia
  readonly origin_farm_id?: string;
  readonly origin_pool_id?: string;
  // Incubador
  readonly nido_number?: string;
  readonly eclosion_date?: string;
}

export interface LocalEntrySizeGroup extends SyncMeta {
  readonly id: string;
  readonly entrada_id: string;
  readonly size_inches: number;
  readonly animal_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalMortalidad extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalMortalidadSizeGroup extends SyncMeta {
  readonly id: string;
  readonly mortalidad_id: string;
  readonly size_inches: number;
  readonly animal_count: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalAlimentacion extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id?: string;
  readonly food_type_id: string;
  readonly event_date: string;
  readonly quantity_kg: number;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalFoodStock extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly food_type_id: string;
  readonly current_quantity: number;
  readonly low_stock_threshold?: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalFoodPurchase extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly food_type_id: string;
  readonly purchase_date: string;
  readonly quantity_kg: number;
  readonly supplier?: string;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalClasificacion extends SyncMeta {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly event_date: string;
  readonly total_animals: number;
  readonly notes?: string;
  readonly created_by?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LocalClasificacionGroup extends SyncMeta {
  readonly id: string;
  readonly clasificacion_id: string;
  readonly size_inches: number;
  readonly animal_count: number;
  readonly destination_pool_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SyncOutboxEntry {
  readonly id?: number;
  readonly table_name: string;
  readonly record_id: string;
  readonly operation: "INSERT" | "UPDATE" | "DELETE" | "RPC";
  readonly payload: Record<string, unknown>;
  readonly created_at: string;
  readonly retry_count: number;
}

class CrocoTrackDb extends Dexie {
  organizations!: Table<LocalOrganization>;
  farms!: Table<LocalFarm>;
  pools!: Table<LocalPool>;
  incubators!: Table<LocalIncubator>;
  food_types!: Table<LocalFoodType>;
  lotes!: Table<LocalLote>;
  lote_size_compositions!: Table<LocalLoteSizeComposition>;
  entradas!: Table<LocalEntrada>;
  entry_size_groups!: Table<LocalEntrySizeGroup>;
  mortalidades!: Table<LocalMortalidad>;
  mortalidad_size_groups!: Table<LocalMortalidadSizeGroup>;
  alimentaciones!: Table<LocalAlimentacion>;
  food_stock!: Table<LocalFoodStock>;
  food_purchases!: Table<LocalFoodPurchase>;
  clasificaciones!: Table<LocalClasificacion>;
  clasificacion_groups!: Table<LocalClasificacionGroup>;
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
    this.version(2).stores({
      lotes: "id, pool_id, farm_id, org_id, status, _sync_status",
      lote_size_compositions: "id, lote_id, _sync_status",
    });
    this.version(3).stores({
      entradas: "id, org_id, farm_id, pool_id, lote_id, origin_type, entry_date, _sync_status",
      entry_size_groups: "id, entrada_id, _sync_status",
    });
    this.version(4).stores({
      mortalidades: "id, org_id, farm_id, pool_id, lote_id, event_date, _sync_status",
      mortalidad_size_groups: "id, mortalidad_id, _sync_status",
    });
    this.version(5).stores({
      alimentaciones:
        "id, org_id, farm_id, pool_id, lote_id, food_type_id, event_date, _sync_status",
      food_stock: "id, org_id, farm_id, food_type_id, [farm_id+food_type_id], _sync_status",
      food_purchases: "id, org_id, farm_id, food_type_id, purchase_date, _sync_status",
    });
    this.version(6).stores({
      clasificaciones: "id, org_id, farm_id, pool_id, lote_id, event_date, _sync_status",
      clasificacion_groups: "id, clasificacion_id, _sync_status",
    });
  }
}

export const db = new CrocoTrackDb();
