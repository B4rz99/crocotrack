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
import type { CreateSacrificioInput } from "@/shared/schemas/sacrificio.schema";
import { createSacrificio, getSacrificioById, getSacrificiosByFarm } from "../sacrificios.api";

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

const baseInput: CreateSacrificioInput = {
  pool_id: POOL_ID,
  event_date: "2026-04-02",
  groups: [
    {
      size_inches: 12,
      sacrificed_count: 3,
      rejected: [{ animal_count: 2, destination_pool_id: DEST_POOL_ID }],
    },
  ],
};

const makeSacrificio = (overrides: Record<string, unknown> = {}) => ({
  id: "sacrificio-001",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  pool_id: POOL_ID,
  lote_id: LOTE_ID,
  event_date: "2026-04-02",
  total_animals: 10,
  total_sacrificed: 3,
  total_rejected: 2,
  total_faltantes: 5,
  notes: null,
  is_active: true,
  created_at: "2026-04-02T10:00:00.000Z",
  updated_at: "2026-04-02T10:00:00.000Z",
  created_by: null,
  sacrificio_size_groups: [
    {
      group_type: "sacrificado" as const,
      size_inches: 12,
      animal_count: 3,
      destination_pool_id: null,
    },
    {
      group_type: "rechazado" as const,
      size_inches: 12,
      animal_count: 2,
      destination_pool_id: DEST_POOL_ID,
    },
  ],
  profiles: { full_name: "Juan García" },
  pools: { name: "Pileta Norte" },
  ...overrides,
});

describe("sacrificios.api", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    const mockRpc = await getMockRpc();
    mockFrom.mockReset();
    mockRpc.mockReset();
    vi.mocked(addToOutbox).mockReset();
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(async () => {
    await db.delete();
    vi.unstubAllGlobals();
  });

  describe("getSacrificiosByFarm", () => {
    it("returns server data and caches to Dexie on success", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeSacrificio()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getSacrificiosByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("sacrificios");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(mockData);

      const cached = await db.sacrificios.get("sacrificio-001");
      expect(cached).toBeDefined();
      expect(cached?._sync_status).toBe("synced");
      expect(cached?.total_sacrificed).toBe(3);
    });
  });

  describe("getSacrificioById", () => {
    it("filters by farm_id on Supabase", async () => {
      const mockFrom = await getMockFrom();
      const row = makeSacrificio();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
      const mockEqFarm = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqFarm });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getSacrificioById("sacrificio-001", FARM_ID);

      expect(mockEqId).toHaveBeenCalledWith("id", "sacrificio-001");
      expect(mockEqFarm).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(result).toEqual(row);
    });

    it("falls back to Dexie when Supabase returns an error", async () => {
      const mockFrom = await getMockFrom();
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqFarm = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqFarm });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const now = "2026-04-02T10:00:00.000Z";
      await db.sacrificios.put({
        id: "sacrificio-001",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        pool_id: POOL_ID,
        lote_id: LOTE_ID,
        event_date: "2026-04-02",
        total_animals: 10,
        total_sacrificed: 3,
        total_rejected: 2,
        total_faltantes: 5,
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });
      await db.sacrificio_size_groups.add({
        id: "sg-1",
        sacrificio_id: "sacrificio-001",
        group_type: "sacrificado",
        size_inches: 12,
        animal_count: 3,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      const result = await getSacrificioById("sacrificio-001", FARM_ID);

      expect(result?.id).toBe("sacrificio-001");
      expect(result?.sacrificio_size_groups).toHaveLength(1);
      expect(result?.sacrificio_size_groups[0]?.animal_count).toBe(3);
    });

    it("returns null on Supabase error when Dexie row is for another farm", async () => {
      const mockFrom = await getMockFrom();
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqFarm = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqFarm });
      mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEqId }) });

      const now = "2026-04-02T10:00:00.000Z";
      await db.sacrificios.put({
        id: "sacrificio-001",
        org_id: ORG_ID,
        farm_id: "other-farm",
        pool_id: POOL_ID,
        lote_id: LOTE_ID,
        event_date: "2026-04-02",
        total_animals: 10,
        total_sacrificed: 3,
        total_rejected: 2,
        total_faltantes: 5,
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      const result = await getSacrificioById("sacrificio-001", FARM_ID);
      expect(result).toBeNull();
    });
  });

  describe("createSacrificio", () => {
    it("writes to Dexie as synced and does NOT add to outbox on RPC success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await createSacrificio(ORG_ID, FARM_ID, baseInput, LOTE_ID, 10);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_sacrificio",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_pool_id: POOL_ID,
          p_event_date: "2026-04-02",
          p_notes: null,
        })
      );

      const local = await db.sacrificios.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.total_animals).toBe(10);
      expect(local?.lote_id).toBe(LOTE_ID);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("throws on RPC failure when online and does not persist local or outbox", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "Stock insuficiente" } });

      await expect(createSacrificio(ORG_ID, FARM_ID, baseInput, LOTE_ID, 10)).rejects.toThrow(
        "Stock insuficiente"
      );

      const count = await db.sacrificios.count();
      expect(count).toBe(0);
      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("writes pending and outbox on RPC failure when offline", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createSacrificio(ORG_ID, FARM_ID, baseInput, LOTE_ID, 10);

      const local = await db.sacrificios.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_sacrificio",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          p_org_id: ORG_ID,
          _entity_table: "sacrificios",
        })
      );
    });
  });
});
