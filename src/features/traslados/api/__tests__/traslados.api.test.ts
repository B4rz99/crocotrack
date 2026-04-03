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
import { createTraslado, getTrasladosByFarm } from "../traslados.api";

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
const DEST_POOL_ID = "33333333-3333-3333-8333-333333333333";
const LOTE_ID = "22222222-2222-2222-8222-222222222222";

const makeTraslado = (overrides: Record<string, unknown> = {}) => ({
  id: "traslado-001",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  pool_id: POOL_ID,
  lote_id: LOTE_ID,
  destination_pool_id: DEST_POOL_ID,
  event_date: "2026-04-02",
  total_animals: 5,
  notes: null,
  is_active: true,
  created_at: "2026-04-02T10:00:00.000Z",
  updated_at: "2026-04-02T10:00:00.000Z",
  created_by: null,
  traslado_size_groups: [{ size_inches: 12, animal_count: 5 }],
  profiles: { full_name: "Juan García" },
  origin_pool: { name: "Pileta Norte" },
  destination_pool: { name: "Pileta Sur" },
  ...overrides,
});

describe("traslados.api", () => {
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

  describe("getTrasladosByFarm", () => {
    it("returns server data and caches to Dexie on success", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeTraslado()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getTrasladosByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("traslados");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(mockData);

      const cached = await db.traslados.get("traslado-001");
      expect(cached).toBeDefined();
      expect(cached?._sync_status).toBe("synced");
      expect(cached?.total_animals).toBe(5);
    });

    it("returns local Dexie data with empty join fields on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      await db.traslados.add({
        id: "traslado-local",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        pool_id: POOL_ID,
        lote_id: LOTE_ID,
        destination_pool_id: DEST_POOL_ID,
        event_date: "2026-04-02",
        total_animals: 3,
        is_active: true,
        created_at: "2026-04-02T10:00:00.000Z",
        updated_at: "2026-04-02T10:00:00.000Z",
        _sync_status: "pending",
        _local_updated_at: "2026-04-02T10:00:00.000Z",
      });

      const result = await getTrasladosByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("traslado-local");
      expect(result[0]?.traslado_size_groups).toEqual([]);
      expect(result[0]?.profiles).toBeNull();
      expect(result[0]?.origin_pool).toBeNull();
      expect(result[0]?.destination_pool).toBeNull();
    });
  });

  describe("createTraslado", () => {
    const baseInput = {
      pool_id: POOL_ID,
      destination_pool_id: DEST_POOL_ID,
      event_date: "2026-04-02",
      compositions: [{ size_inches: 12, animal_count: 5 }],
    };

    it("writes to Dexie as synced and does NOT add to outbox on RPC success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "traslado-id", error: null });

      const result = await createTraslado(ORG_ID, FARM_ID, baseInput, LOTE_ID);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_traslado",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_pool_id: POOL_ID,
          p_destination_pool_id: DEST_POOL_ID,
          p_event_date: "2026-04-02",
          p_compositions: [{ size_inches: 12, animal_count: 5 }],
          p_notes: null,
        })
      );

      const local = await db.traslados.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.total_animals).toBe(5);
      expect(local?.lote_id).toBe(LOTE_ID);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("writes to Dexie as pending and adds to outbox on RPC failure", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createTraslado(ORG_ID, FARM_ID, baseInput, LOTE_ID);

      const local = await db.traslados.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_traslado",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          p_org_id: ORG_ID,
          _entity_table: "traslados",
        })
      );
    });
  });
});
