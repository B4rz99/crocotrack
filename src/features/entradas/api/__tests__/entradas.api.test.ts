import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabase", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  return {
    supabase: { from: mockFrom, rpc: mockRpc },
    untypedSupabase: { from: mockFrom, rpc: mockRpc, storage: mockStorage },
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
    __mockStorage: mockStorage,
  };
});

vi.mock("@/shared/lib/sync", () => ({
  addToOutbox: vi.fn(),
}));

import { db } from "@/shared/lib/db";
import { addToOutbox } from "@/shared/lib/sync";
import { createEntrada, getEntradasByFarm } from "../entradas.api";

async function getMockFrom() {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockFrom: ReturnType<typeof vi.fn> }).__mockFrom;
}

async function getMockRpc() {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockRpc: ReturnType<typeof vi.fn> }).__mockRpc;
}

const FARM_ID = "farm-001";
const ORG_ID = "org-001";
const POOL_ID = "11111111-1111-1111-8111-111111111111";
const LOTE_ID = "lote-001";

const makeEntrada = (overrides: Record<string, unknown> = {}) => ({
  id: "entrada-001",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  pool_id: POOL_ID,
  lote_id: LOTE_ID,
  origin_type: "incubador" as const,
  entry_date: "2026-04-01",
  total_animals: 60,
  notes: null,
  is_active: true,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  created_by: null,
  persona_full_name: null,
  persona_document_id: null,
  persona_aval_code: null,
  persona_aval_file_path: null,
  empresa_name: null,
  empresa_legal_rep: null,
  empresa_nit: null,
  empresa_aval_code: null,
  empresa_aval_file_path: null,
  origin_farm_id: null,
  origin_pool_id: null,
  nido_number: "N-001",
  eclosion_date: "2026-03-15",
  entry_size_groups: [{ size_inches: 12, animal_count: 60 }],
  profiles: { full_name: "Juan García" },
  pools: { name: "Pileta Norte" },
  ...overrides,
});

describe("entradas.api", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    const mockRpc = await getMockRpc();
    mockFrom.mockReset();
    mockRpc.mockReset();
    vi.mocked(addToOutbox).mockReset();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("getEntradasByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeEntrada()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getEntradasByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("entradas");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(mockData);

      const cached = await db.entradas.get("entrada-001");
      expect(cached).toBeDefined();
      expect(cached?.origin_type).toBe("incubador");
      expect(cached?._sync_status).toBe("synced");
    });

    it("falls back to Dexie on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      await db.entradas.add({
        id: "entrada-local",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        pool_id: POOL_ID,
        lote_id: LOTE_ID,
        origin_type: "incubador",
        entry_date: "2026-04-01",
        total_animals: 30,
        is_active: true,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        nido_number: "N-002",
        eclosion_date: "2026-03-10",
        _sync_status: "pending",
        _local_updated_at: "2026-04-01T00:00:00.000Z",
      });

      const result = await getEntradasByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("entrada-local");
    });
  });

  describe("createEntrada", () => {
    const incubadorInput = {
      pool_id: POOL_ID,
      entry_date: "2026-04-01",
      compositions: [{ size_inches: 12, animal_count: 60 }],
      origin_type: "incubador" as const,
      nido_number: "N-001",
      eclosion_date: "2026-03-15",
    };

    // Sets up mockFrom to handle the post-RPC lote_id fetch
    async function mockLoteIdFetch(loteId: string = LOTE_ID) {
      const mockFrom = await getMockFrom();
      const mockSingle = vi.fn().mockResolvedValue({ data: { lote_id: loteId }, error: null });
      const mockEqId = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelectLoteId = vi.fn().mockReturnValue({ eq: mockEqId });
      mockFrom.mockReturnValue({ select: mockSelectLoteId });
    }

    it("calls RPC and writes synced record to Dexie on success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "entrada-id", error: null });
      await mockLoteIdFetch();

      const result = await createEntrada(ORG_ID, FARM_ID, incubadorInput);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_entrada",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_pool_id: POOL_ID,
          p_origin_type: "incubador",
          p_nido_number: "N-001",
          p_eclosion_date: "2026-03-15",
        })
      );

      const local = await db.entradas.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.total_animals).toBe(60);
      expect(local?.lote_id).toBe(LOTE_ID);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("queues RPC to outbox on Supabase failure and includes _entity_table", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createEntrada(ORG_ID, FARM_ID, incubadorInput);

      const local = await db.entradas.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_entrada",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          _entity_table: "entradas",
        })
      );
    });

    it("builds correct payload for proveedor_persona", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });
      await mockLoteIdFetch();

      const personaInput = {
        pool_id: POOL_ID,
        entry_date: "2026-04-01",
        compositions: [{ size_inches: 24, animal_count: 20 }],
        origin_type: "proveedor_persona" as const,
        persona_full_name: "María López",
        persona_document_id: "87654321",
        persona_aval_code: "AVAL-123",
      };

      await createEntrada(ORG_ID, FARM_ID, personaInput);

      expect(mockRpc).toHaveBeenCalledWith(
        "create_entrada",
        expect.objectContaining({
          p_origin_type: "proveedor_persona",
          p_persona_full_name: "María López",
          p_persona_document_id: "87654321",
          p_persona_aval_code: "AVAL-123",
        })
      );
    });

    it("builds correct payload for proveedor_empresa", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });
      await mockLoteIdFetch();

      const empresaInput = {
        pool_id: POOL_ID,
        entry_date: "2026-04-01",
        compositions: [{ size_inches: 18, animal_count: 100 }],
        origin_type: "proveedor_empresa" as const,
        empresa_name: "Crocofarm S.A.S.",
        empresa_legal_rep: "Pedro Gómez",
        empresa_nit: "900123456-1",
      };

      await createEntrada(ORG_ID, FARM_ID, empresaInput);

      expect(mockRpc).toHaveBeenCalledWith(
        "create_entrada",
        expect.objectContaining({
          p_origin_type: "proveedor_empresa",
          p_empresa_name: "Crocofarm S.A.S.",
          p_empresa_legal_rep: "Pedro Gómez",
          p_empresa_nit: "900123456-1",
        })
      );
    });

    it("builds correct payload for finca_propia", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });
      await mockLoteIdFetch();

      const fincaInput = {
        pool_id: POOL_ID,
        entry_date: "2026-04-01",
        compositions: [{ size_inches: 12, animal_count: 40 }],
        origin_type: "finca_propia" as const,
        origin_farm_id: "22222222-2222-2222-8222-222222222222",
        origin_pool_id: "33333333-3333-3333-8333-333333333333",
      };

      await createEntrada(ORG_ID, FARM_ID, fincaInput);

      expect(mockRpc).toHaveBeenCalledWith(
        "create_entrada",
        expect.objectContaining({
          p_origin_type: "finca_propia",
          p_origin_farm_id: "22222222-2222-2222-8222-222222222222",
          p_origin_pool_id: "33333333-3333-3333-8333-333333333333",
        })
      );
    });

    it("calculates total_animals correctly from multiple groups", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });
      await mockLoteIdFetch();

      const multiGroupInput = {
        pool_id: POOL_ID,
        entry_date: "2026-04-01",
        compositions: [
          { size_inches: 12, animal_count: 30 },
          { size_inches: 18, animal_count: 20 },
          { size_inches: 24, animal_count: 10 },
        ],
        origin_type: "incubador" as const,
        nido_number: "N-003",
        eclosion_date: "2026-03-01",
      };

      const result = await createEntrada(ORG_ID, FARM_ID, multiGroupInput);

      const local = await db.entradas.get(result.id);
      expect(local?.total_animals).toBe(60);
    });
  });
});
