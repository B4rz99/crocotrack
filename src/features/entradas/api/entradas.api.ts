import { db } from "@/shared/lib/db";
import { untypedSupabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import { generateId, nowISO } from "@/shared/lib/utils";
import type { CreateEntradaInput } from "@/shared/schemas/entrada.schema";

interface EntrySizeGroup {
  readonly size_inches: number;
  readonly animal_count: number;
}

export interface EntradaWithDetails {
  readonly id: string;
  readonly org_id: string;
  readonly farm_id: string;
  readonly pool_id: string;
  readonly lote_id: string;
  readonly origin_type: "proveedor_persona" | "proveedor_empresa" | "finca_propia" | "incubador";
  readonly entry_date: string;
  readonly total_animals: number;
  readonly notes: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by: string | null;
  // Proveedor persona
  readonly persona_full_name: string | null;
  readonly persona_document_id: string | null;
  readonly persona_aval_code: string | null;
  readonly persona_aval_file_path: string | null;
  // Proveedor empresa
  readonly empresa_name: string | null;
  readonly empresa_legal_rep: string | null;
  readonly empresa_nit: string | null;
  readonly empresa_aval_code: string | null;
  readonly empresa_aval_file_path: string | null;
  // Finca propia
  readonly origin_farm_id: string | null;
  readonly origin_pool_id: string | null;
  // Incubador
  readonly nido_number: string | null;
  readonly eclosion_date: string | null;
  // Relations
  readonly entry_size_groups: readonly EntrySizeGroup[];
  readonly profiles: { readonly full_name: string } | null;
  readonly pools: { readonly name: string } | null;
}

export async function getEntradasByFarm(farmId: string): Promise<EntradaWithDetails[]> {
  const { data, error } = (await untypedSupabase
    .from("entradas")
    .select(
      `
      *,
      entry_size_groups ( size_inches, animal_count ),
      profiles ( full_name ),
      pools ( name )
    `
    )
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("entry_date", { ascending: false })) as {
    data: EntradaWithDetails[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    const local = await db.entradas
      .where("farm_id")
      .equals(farmId)
      .filter((e) => e.is_active)
      .reverse()
      .sortBy("entry_date");
    return local.map((e) => ({
      ...e,
      notes: e.notes ?? null,
      created_by: e.created_by ?? null,
      persona_full_name: e.persona_full_name ?? null,
      persona_document_id: e.persona_document_id ?? null,
      persona_aval_code: e.persona_aval_code ?? null,
      persona_aval_file_path: e.persona_aval_file_path ?? null,
      empresa_name: e.empresa_name ?? null,
      empresa_legal_rep: e.empresa_legal_rep ?? null,
      empresa_nit: e.empresa_nit ?? null,
      empresa_aval_code: e.empresa_aval_code ?? null,
      empresa_aval_file_path: e.empresa_aval_file_path ?? null,
      origin_farm_id: e.origin_farm_id ?? null,
      origin_pool_id: e.origin_pool_id ?? null,
      nido_number: e.nido_number ?? null,
      eclosion_date: e.eclosion_date ?? null,
      entry_size_groups: [],
      profiles: null,
      pools: null,
    }));
  }

  const now = nowISO();
  await db.entradas.bulkPut(
    data.map(({ entry_size_groups: _esg, profiles: _p, pools: _pools, ...entrada }) => ({
      ...entrada,
      notes: entrada.notes ?? undefined,
      created_by: entrada.created_by ?? undefined,
      persona_full_name: entrada.persona_full_name ?? undefined,
      persona_document_id: entrada.persona_document_id ?? undefined,
      persona_aval_code: entrada.persona_aval_code ?? undefined,
      persona_aval_file_path: entrada.persona_aval_file_path ?? undefined,
      empresa_name: entrada.empresa_name ?? undefined,
      empresa_legal_rep: entrada.empresa_legal_rep ?? undefined,
      empresa_nit: entrada.empresa_nit ?? undefined,
      empresa_aval_code: entrada.empresa_aval_code ?? undefined,
      empresa_aval_file_path: entrada.empresa_aval_file_path ?? undefined,
      origin_farm_id: entrada.origin_farm_id ?? undefined,
      origin_pool_id: entrada.origin_pool_id ?? undefined,
      nido_number: entrada.nido_number ?? undefined,
      eclosion_date: entrada.eclosion_date ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    }))
  );

  return data;
}

function buildRpcPayload(
  id: string,
  orgId: string,
  farmId: string,
  input: CreateEntradaInput,
  avalFilePath?: string
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    p_id: id,
    p_org_id: orgId,
    p_farm_id: farmId,
    p_pool_id: input.pool_id,
    p_origin_type: input.origin_type,
    p_entry_date: input.entry_date,
    p_compositions: input.compositions,
    p_notes: input.notes ?? null,
  };

  if (input.origin_type === "proveedor_persona") {
    base.p_persona_full_name = input.persona_full_name;
    base.p_persona_document_id = input.persona_document_id;
    base.p_persona_aval_code = input.persona_aval_code ?? null;
    base.p_persona_aval_file_path = avalFilePath ?? input.persona_aval_file_path ?? null;
  } else if (input.origin_type === "proveedor_empresa") {
    base.p_empresa_name = input.empresa_name;
    base.p_empresa_legal_rep = input.empresa_legal_rep;
    base.p_empresa_nit = input.empresa_nit;
    base.p_empresa_aval_code = input.empresa_aval_code ?? null;
    base.p_empresa_aval_file_path = avalFilePath ?? input.empresa_aval_file_path ?? null;
  } else if (input.origin_type === "finca_propia") {
    base.p_origin_farm_id = input.origin_farm_id;
    base.p_origin_pool_id = input.origin_pool_id;
  } else if (input.origin_type === "incubador") {
    base.p_nido_number = input.nido_number;
    base.p_eclosion_date = input.eclosion_date;
  }

  return base;
}

function safeFileName(name: string): string {
  const ext = (name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 10);
  return `${generateId()}.${ext}`;
}

export async function uploadAvalDocument(
  orgId: string,
  entradaId: string,
  file: File
): Promise<string> {
  const path = `${orgId}/${entradaId}/${safeFileName(file.name)}`;
  const { error } = await untypedSupabase.storage
    .from("aval-documents")
    .upload(path, file, { upsert: false });

  if (error) {
    throw new Error(`Error al subir el documento: ${(error as { message: string }).message}`);
  }

  return path;
}

export async function createEntrada(
  orgId: string,
  farmId: string,
  input: CreateEntradaInput,
  avalFile?: File
): Promise<{ id: string }> {
  const id = generateId();
  const now = nowISO();

  // File contents cannot be serialised into the outbox, so uploads are best-effort.
  // If the upload fails (e.g. offline), the entrada is still saved and synced;
  // the aval file path will simply be absent and must be uploaded separately later.
  let avalFilePath: string | undefined;
  if (avalFile) {
    try {
      avalFilePath = await uploadAvalDocument(orgId, id, avalFile);
    } catch {
      // intentionally swallowed — proceed without the file path
    }
  }

  const rpcPayload = buildRpcPayload(id, orgId, farmId, input, avalFilePath);

  const { error } = await untypedSupabase.rpc("create_entrada", rpcPayload);

  const totalAnimals = input.compositions.reduce((sum, c) => sum + c.animal_count, 0);

  // Fetch the lote_id assigned by the RPC (unknown until the server runs the function)
  let loteId = "";
  if (!error) {
    const { data: row } = (await untypedSupabase
      .from("entradas")
      .select("lote_id")
      .eq("id", id)
      .single()) as { data: { lote_id: string } | null; error: unknown };
    loteId = row?.lote_id ?? "";
  }

  const localEntrada = {
    id,
    org_id: orgId,
    farm_id: farmId,
    pool_id: input.pool_id,
    lote_id: loteId,
    origin_type: input.origin_type,
    entry_date: input.entry_date,
    total_animals: totalAnimals,
    is_active: true,
    created_at: now,
    updated_at: now,
    notes: input.notes,
    ...(input.origin_type === "proveedor_persona" && {
      persona_full_name: input.persona_full_name,
      persona_document_id: input.persona_document_id,
      persona_aval_code: input.persona_aval_code,
      persona_aval_file_path: avalFilePath ?? input.persona_aval_file_path,
    }),
    ...(input.origin_type === "proveedor_empresa" && {
      empresa_name: input.empresa_name,
      empresa_legal_rep: input.empresa_legal_rep,
      empresa_nit: input.empresa_nit,
      empresa_aval_code: input.empresa_aval_code,
      empresa_aval_file_path: avalFilePath ?? input.empresa_aval_file_path,
    }),
    ...(input.origin_type === "finca_propia" && {
      origin_farm_id: input.origin_farm_id,
      origin_pool_id: input.origin_pool_id,
    }),
    ...(input.origin_type === "incubador" && {
      nido_number: input.nido_number,
      eclosion_date: input.eclosion_date,
    }),
    _sync_status: error ? ("pending" as const) : ("synced" as const),
    _local_updated_at: now,
  };

  await db.entradas.put(localEntrada);

  if (error) {
    // _entity_table tells the sync engine which Dexie table to mark synced on flush
    await addToOutbox("create_entrada", id, "RPC", { ...rpcPayload, _entity_table: "entradas" });
  }

  return { id };
}
