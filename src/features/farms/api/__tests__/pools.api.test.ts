import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabase", () => {
  const mockFrom = vi.fn();
  return {
    supabase: { from: mockFrom },
    untypedSupabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

import { db } from "@/shared/lib/db";
import { createPool, deletePool, getPoolsByFarm, updatePool } from "../pools.api";

async function getMockFrom() {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockFrom: ReturnType<typeof vi.fn> }).__mockFrom;
}

const ORG_ID = "org-1";
const FARM_ID = "farm-1";

const makePoolRow = (overrides: Record<string, unknown> = {}) => ({
  id: "pool-1",
  org_id: ORG_ID,
  farm_id: FARM_ID,
  name: "Pileta Alpha",
  code: null,
  pool_type: "crianza" as const,
  capacity: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("Pools API", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    mockFrom.mockReset();
  });

  describe("getPoolsByFarm", () => {
    it("returns pools from Supabase and populates Dexie", async () => {
      const mockFrom = await getMockFrom();
      const pools = [makePoolRow(), makePoolRow({ id: "pool-2", name: "Pileta Beta" })];

      const mockOrder = vi.fn().mockResolvedValue({ data: pools, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getPoolsByFarm(FARM_ID);

      expect(result).toEqual(pools);
      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq1).toHaveBeenCalledWith("farm_id", FARM_ID);
      expect(mockEq2).toHaveBeenCalledWith("is_active", true);
      expect(mockOrder).toHaveBeenCalledWith("name");

      const localPools = await db.pools.toArray();
      expect(localPools).toHaveLength(2);
      expect(localPools[0]?._sync_status).toBe("synced");
      expect(localPools[1]?._sync_status).toBe("synced");
    });

    it("falls back to Dexie when offline", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "Network error" } });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      const now = new Date().toISOString();
      await db.pools.bulkAdd([
        {
          id: "pool-local-1",
          org_id: ORG_ID,
          farm_id: FARM_ID,
          name: "Local Pool A",
          pool_type: "crianza" as const,
          is_active: true,
          created_at: now,
          updated_at: now,
          _sync_status: "pending",
          _local_updated_at: now,
        },
        {
          id: "pool-local-2",
          org_id: ORG_ID,
          farm_id: FARM_ID,
          name: "Local Pool B",
          pool_type: "reproductor" as const,
          is_active: false,
          created_at: now,
          updated_at: now,
          _sync_status: "pending",
          _local_updated_at: now,
        },
      ]);

      const result = await getPoolsByFarm(FARM_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Local Pool A");
    });
  });

  describe("createPool", () => {
    it("writes to Supabase and Dexie with synced status", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { id } = await createPool(ORG_ID, FARM_ID, {
        name: "Nuevo Pileta",
        pool_type: "reproductor",
        capacity: 50,
      });

      expect(id).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          org_id: ORG_ID,
          farm_id: FARM_ID,
          name: "Nuevo Pileta",
          pool_type: "reproductor",
          capacity: 50,
          is_active: true,
        }),
      );

      const local = await db.pools.get(id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.name).toBe("Nuevo Pileta");
      expect(local?.pool_type).toBe("reproductor");
    });

    it("adds to outbox on Supabase failure", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { id } = await createPool(ORG_ID, FARM_ID, {
        name: "Offline Pool",
        pool_type: "crianza",
        capacity: 30,
      });

      const local = await db.pools.get(id);
      expect(local?._sync_status).toBe("pending");

      const outbox = await db.sync_outbox.toArray();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        table_name: "pools",
        record_id: id,
        operation: "INSERT",
      });
    });
  });

  describe("updatePool", () => {
    it("updates in Supabase and Dexie", async () => {
      const mockFrom = await getMockFrom();

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const now = new Date().toISOString();
      await db.pools.add({
        id: "pool-upd",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "Old Pool",
        pool_type: "crianza" as const,
        capacity: 50,
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      await updatePool("pool-upd", {
        name: "Updated Pool",
        pool_type: "reproductor",
        capacity: 200,
      });

      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Pool",
          pool_type: "reproductor",
          capacity: 200,
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "pool-upd");

      const local = await db.pools.get("pool-upd");
      expect(local?.name).toBe("Updated Pool");
      expect(local?.pool_type).toBe("reproductor");
      expect(local?.capacity).toBe(200);
      expect(local?._sync_status).toBe("synced");
    });
  });

  describe("deletePool", () => {
    it("soft deletes via is_active = false", async () => {
      const mockFrom = await getMockFrom();

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const now = new Date().toISOString();
      await db.pools.add({
        id: "pool-del",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        name: "To Delete",
        pool_type: "crianza" as const,
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      await deletePool("pool-del");

      expect(mockFrom).toHaveBeenCalledWith("pools");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(mockEq).toHaveBeenCalledWith("id", "pool-del");

      const local = await db.pools.get("pool-del");
      expect(local?.is_active).toBe(false);
      expect(local?._sync_status).toBe("synced");
    });
  });
});
