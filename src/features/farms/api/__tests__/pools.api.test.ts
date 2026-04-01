import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabase", () => {
  const mockFrom = vi.fn();
  return {
    supabase: { from: mockFrom },
    untypedSupabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

vi.mock("@/shared/lib/sync", () => ({
  addToOutbox: vi.fn(),
}));

import { db } from "@/shared/lib/db";
import { addToOutbox } from "@/shared/lib/sync";
import { createPool, deletePool, getPoolsByFarm, updatePool } from "../pools.api";

async function getMockFrom() {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockFrom: ReturnType<typeof vi.fn> }).__mockFrom;
}

const FARM_ID = "farm-001";
const ORG_ID = "org-001";
const POOL_ID = "pool-001";

const makeMockPoolWithLotes = (overrides: Record<string, unknown> = {}) => ({
  id: POOL_ID,
  org_id: ORG_ID,
  farm_id: FARM_ID,
  name: "Pileta Norte",
  code: "PN-01",
  pool_type: "crianza" as const,
  capacity: 200,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  lotes: [
    {
      id: "lote-001",
      status: "activo",
      opened_at: "2026-01-15T00:00:00.000Z",
      lote_size_compositions: [
        { size_inches: 12, animal_count: 50 },
        { size_inches: 18, animal_count: 30 },
      ],
    },
  ],
  ...overrides,
});

describe("pools.api", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    mockFrom.mockReset();
    vi.mocked(addToOutbox).mockReset();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("getPoolsByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [makeMockPoolWithLotes()];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqLotesStatus = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqIsActive = vi.fn().mockReturnValue({ eq: mockEqLotesStatus });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getPoolsByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockEqFarmId).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);
      expect(mockEqLotesStatus).toHaveBeenCalledWith("lotes.status", "activo");
      expect(result).toEqual(mockData);

      // Verify Dexie cache was populated (without lotes)
      const cached = await db.pools.get(POOL_ID);
      expect(cached).toBeDefined();
      expect(cached?.name).toBe("Pileta Norte");
      expect(cached?._sync_status).toBe("synced");
    });

    it("falls back to Dexie on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqLotesStatus = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqIsActive = vi.fn().mockReturnValue({ eq: mockEqLotesStatus });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      // Pre-populate Dexie with a local pool
      await db.pools.add({
        id: POOL_ID,
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "Pileta Local",
        pool_type: "crianza",
        capacity: 100,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        _sync_status: "pending",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      // Also add an inactive pool that should be filtered out
      await db.pools.add({
        id: "pool-inactive",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "Pileta Inactiva",
        pool_type: "crianza",
        is_active: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        _sync_status: "synced",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      const result = await getPoolsByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Pileta Local");
    });
  });

  describe("createPool", () => {
    it("writes to Supabase and Dexie on success", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const input = {
        name: "Pileta Sur",
        code: "PS-01",
        pool_type: "crianza" as const,
        capacity: 150,
      };
      const result = await createPool(ORG_ID, FARM_ID, input);

      expect(result.id).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: ORG_ID,
          farm_id: FARM_ID,
          name: "Pileta Sur",
          code: "PS-01",
          pool_type: "crianza",
          capacity: 150,
          is_active: true,
        }),
      );

      // Verify Dexie record
      const local = await db.pools.get(result.id);
      expect(local).toBeDefined();
      expect(local?.name).toBe("Pileta Sur");
      expect(local?._sync_status).toBe("synced");

      // Should NOT add to outbox on success
      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("adds to outbox when Supabase fails", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: { message: "network error" } });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const input = { name: "Pileta Offline", pool_type: "reproductor" as const, capacity: 80 };
      const result = await createPool(ORG_ID, FARM_ID, input);

      // Dexie record should be marked pending
      const local = await db.pools.get(result.id);
      expect(local?._sync_status).toBe("pending");

      // Should add to outbox
      expect(addToOutbox).toHaveBeenCalledWith(
        "pools",
        result.id,
        "INSERT",
        expect.objectContaining({
          id: result.id,
          org_id: ORG_ID,
          farm_id: FARM_ID,
          name: "Pileta Offline",
        }),
      );
    });
  });

  describe("updatePool", () => {
    it("updates Supabase and Dexie on success", async () => {
      const mockFrom = await getMockFrom();

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      // Pre-populate Dexie
      await db.pools.add({
        id: POOL_ID,
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "Pileta Vieja",
        pool_type: "crianza",
        capacity: 100,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        _sync_status: "synced",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      const input = { name: "Pileta Renovada", pool_type: "reproductor" as const, capacity: 250 };
      await updatePool(POOL_ID, input);

      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Pileta Renovada",
          pool_type: "reproductor",
          capacity: 250,
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", POOL_ID);

      // Verify Dexie record updated
      const local = await db.pools.get(POOL_ID);
      expect(local?.name).toBe("Pileta Renovada");
      expect(local?.pool_type).toBe("reproductor");
      expect(local?._sync_status).toBe("synced");

      expect(addToOutbox).not.toHaveBeenCalled();
    });
  });

  describe("deletePool", () => {
    it("sets is_active = false (soft delete)", async () => {
      const mockFrom = await getMockFrom();

      // First call: lotes guard check (no active lotes)
      const mockLotesLimit = vi.fn().mockResolvedValue({ data: [] });
      const mockLotesEqStatus = vi.fn().mockReturnValue({ limit: mockLotesLimit });
      const mockLotesEqPoolId = vi.fn().mockReturnValue({ eq: mockLotesEqStatus });
      const mockLotesSelect = vi.fn().mockReturnValue({ eq: mockLotesEqPoolId });

      // Second call: pools update
      const mockPoolsEq = vi.fn().mockResolvedValue({ error: null });
      const mockPoolsUpdate = vi.fn().mockReturnValue({ eq: mockPoolsEq });

      mockFrom.mockImplementation((table: string) => {
        if (table === "lotes") {
          return { select: mockLotesSelect };
        }
        return { update: mockPoolsUpdate };
      });

      // Pre-populate Dexie
      await db.pools.add({
        id: POOL_ID,
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "Pileta a Desactivar",
        pool_type: "crianza",
        capacity: 100,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        _sync_status: "synced",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      await deletePool(POOL_ID);

      // Verify lotes guard was called
      expect(mockFrom).toHaveBeenCalledWith("lotes");
      expect(mockLotesEqPoolId).toHaveBeenCalledWith("pool_id", POOL_ID);
      expect(mockLotesEqStatus).toHaveBeenCalledWith("status", "activo");

      // Verify pool update was called
      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockPoolsUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(mockPoolsEq).toHaveBeenCalledWith("id", POOL_ID);

      // Verify Dexie record updated
      const local = await db.pools.get(POOL_ID);
      expect(local?.is_active).toBe(false);
      expect(local?._sync_status).toBe("synced");
    });

    it("throws when pool has an active lote", async () => {
      const mockFrom = await getMockFrom();

      // Lotes guard returns an active lote
      const mockLotesLimit = vi.fn().mockResolvedValue({
        data: [{ id: "lote-active" }],
      });
      const mockLotesEqStatus = vi.fn().mockReturnValue({ limit: mockLotesLimit });
      const mockLotesEqPoolId = vi.fn().mockReturnValue({ eq: mockLotesEqStatus });
      const mockLotesSelect = vi.fn().mockReturnValue({ eq: mockLotesEqPoolId });

      mockFrom.mockReturnValue({ select: mockLotesSelect });

      await expect(deletePool(POOL_ID)).rejects.toThrow(
        "Esta pileta tiene un lote activo. Cierre el lote antes de desactivar la pileta.",
      );

      // Verify no pool update was attempted (only lotes query)
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith("lotes");
    });
  });
});
