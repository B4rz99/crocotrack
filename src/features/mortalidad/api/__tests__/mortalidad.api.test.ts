import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabase", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    supabase: { from: mockFrom, rpc: mockRpc },
    untypedSupabase: { from: mockFrom, rpc: mockRpc },
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

vi.mock("@/shared/lib/sync", () => ({
  addToOutbox: vi.fn(),
}));

import { db } from "@/shared/lib/db";
import { addToOutbox } from "@/shared/lib/sync";
import { createMortalidad, getMortalidadesByFarm } from "../mortalidad.api";

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
const LOTE_ID = "22222222-2222-2222-8222-222222222222";

const makeMortalidad = (overrides: Record<string, unknown> = {}) => ({
  id: "mort-001",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  pool_id: POOL_ID,
  lote_id: LOTE_ID,
  event_date: "2026-04-02",
  total_animals: 3,
  notes: null,
  is_active: true,
  created_at: "2026-04-02T10:00:00.000Z",
  updated_at: "2026-04-02T10:00:00.000Z",
  created_by: null,
  mortalidad_size_groups: [{ size_inches: 12, animal_count: 3 }],
  profiles: { full_name: "Juan García" },
  pools: { name: "Pileta Norte" },
  ...overrides,
});

describe("mortalidad.api", () => {
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

  describe("getMortalidadesByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeMortalidad()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getMortalidadesByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("mortalidades");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(mockData);

      const cached = await db.mortalidades.get("mort-001");
      expect(cached).toBeDefined();
      expect(cached?._sync_status).toBe("synced");
      expect(cached?.total_animals).toBe(3);
    });

    it("falls back to Dexie on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      await db.mortalidades.add({
        id: "mort-local",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        pool_id: POOL_ID,
        lote_id: LOTE_ID,
        event_date: "2026-04-02",
        total_animals: 2,
        is_active: true,
        created_at: "2026-04-02T10:00:00.000Z",
        updated_at: "2026-04-02T10:00:00.000Z",
        _sync_status: "pending",
        _local_updated_at: "2026-04-02T10:00:00.000Z",
      });

      const result = await getMortalidadesByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("mort-local");
    });
  });

  describe("createMortalidad", () => {
    const baseInput = {
      pool_id: POOL_ID,
      event_date: "2026-04-02",
      compositions: [{ size_inches: 12, animal_count: 3 }],
    };

    it("calls RPC and writes synced record to Dexie on success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "mort-id", error: null });

      const result = await createMortalidad(ORG_ID, FARM_ID, baseInput, LOTE_ID);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_mortalidad",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_pool_id: POOL_ID,
          p_event_date: "2026-04-02",
          p_compositions: [{ size_inches: 12, animal_count: 3 }],
          p_notes: null,
        })
      );

      const local = await db.mortalidades.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.total_animals).toBe(3);
      expect(local?.lote_id).toBe(LOTE_ID);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("queues RPC to outbox with _entity_table on Supabase failure", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createMortalidad(ORG_ID, FARM_ID, baseInput, LOTE_ID);

      const local = await db.mortalidades.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_mortalidad",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          p_org_id: ORG_ID,
          _entity_table: "mortalidades",
        })
      );
    });

    it("calculates total_animals correctly from multiple size groups", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });

      const multiInput = {
        pool_id: POOL_ID,
        event_date: "2026-04-02",
        compositions: [
          { size_inches: 12, animal_count: 2 },
          { size_inches: 18, animal_count: 5 },
        ],
      };

      const result = await createMortalidad(ORG_ID, FARM_ID, multiInput, LOTE_ID);

      const local = await db.mortalidades.get(result.id);
      expect(local?.total_animals).toBe(7);
    });

    it("passes notes to RPC when provided", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });

      await createMortalidad(
        ORG_ID,
        FARM_ID,
        { ...baseInput, notes: "Encontrados en la mañana" },
        LOTE_ID
      );

      expect(mockRpc).toHaveBeenCalledWith(
        "create_mortalidad",
        expect.objectContaining({ p_notes: "Encontrados en la mañana" })
      );
    });
  });
});
