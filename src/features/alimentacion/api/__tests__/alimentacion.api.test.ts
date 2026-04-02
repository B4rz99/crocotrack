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
import { createAlimentacion, getAlimentacionesByFarm } from "../alimentacion.api";

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
const FOOD_TYPE_ID = "44444444-4444-4444-8444-444444444444";

const makeAlimentacion = (overrides: Record<string, unknown> = {}) => ({
  id: "alim-001",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  pool_id: POOL_ID,
  lote_id: null,
  food_type_id: FOOD_TYPE_ID,
  event_date: "2026-04-02",
  quantity_kg: 25.5,
  notes: null,
  is_active: true,
  created_at: "2026-04-02T10:00:00.000Z",
  updated_at: "2026-04-02T10:00:00.000Z",
  created_by: null,
  food_types: { name: "Pollo", unit: "kg" },
  profiles: { full_name: "Juan Garcia" },
  pools: { name: "Pileta Norte" },
  ...overrides,
});

describe("alimentacion.api", () => {
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

  describe("getAlimentacionesByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeAlimentacion()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getAlimentacionesByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("alimentaciones");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(mockData);

      const cached = await db.alimentaciones.get("alim-001");
      expect(cached).toBeDefined();
      expect(cached?._sync_status).toBe("synced");
      expect(cached?.quantity_kg).toBe(25.5);
    });

    it("falls back to Dexie on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      await db.alimentaciones.add({
        id: "alim-local",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        pool_id: POOL_ID,
        food_type_id: FOOD_TYPE_ID,
        event_date: "2026-04-02",
        quantity_kg: 10,
        is_active: true,
        created_at: "2026-04-02T10:00:00.000Z",
        updated_at: "2026-04-02T10:00:00.000Z",
        _sync_status: "pending",
        _local_updated_at: "2026-04-02T10:00:00.000Z",
      });

      const result = await getAlimentacionesByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("alim-local");
    });
  });

  describe("createAlimentacion", () => {
    const baseInput = {
      pool_id: POOL_ID,
      food_type_id: FOOD_TYPE_ID,
      event_date: "2026-04-02",
      quantity_kg: 25.5,
    };

    it("calls RPC and writes synced record to Dexie on success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "alim-id", error: null });

      const result = await createAlimentacion(ORG_ID, FARM_ID, baseInput);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_alimentacion",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_pool_id: POOL_ID,
          p_food_type_id: FOOD_TYPE_ID,
          p_event_date: "2026-04-02",
          p_quantity_kg: 25.5,
          p_notes: null,
        })
      );

      const local = await db.alimentaciones.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.quantity_kg).toBe(25.5);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("queues RPC to outbox on Supabase failure", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createAlimentacion(ORG_ID, FARM_ID, baseInput);

      const local = await db.alimentaciones.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_alimentacion",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          p_org_id: ORG_ID,
          _entity_table: "alimentaciones",
        })
      );
    });

    it("passes notes to RPC when provided", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });

      await createAlimentacion(ORG_ID, FARM_ID, {
        ...baseInput,
        notes: "Alimentacion de la manana",
      });

      expect(mockRpc).toHaveBeenCalledWith(
        "create_alimentacion",
        expect.objectContaining({ p_notes: "Alimentacion de la manana" })
      );
    });
  });
});
