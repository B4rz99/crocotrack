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
import { createFarm, deleteFarm, getFarms, updateFarm } from "../farms.api";

async function getMockFrom() {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockFrom: ReturnType<typeof vi.fn> }).__mockFrom;
}

const ORG_ID = "org-1";

const makeFarmRow = (overrides: Record<string, unknown> = {}) => ({
  id: "farm-1",
  org_id: ORG_ID,
  name: "Granja Alpha",
  location: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("Farms API", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    mockFrom.mockReset();
  });

  describe("getFarms", () => {
    it("returns data from Supabase and populates Dexie", async () => {
      const mockFrom = await getMockFrom();
      const farms = [makeFarmRow(), makeFarmRow({ id: "farm-2", name: "Granja Beta" })];

      const mockOrder = vi.fn().mockResolvedValue({ data: farms, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getFarms(ORG_ID);

      expect(result).toEqual(farms);
      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq1).toHaveBeenCalledWith("org_id", ORG_ID);
      expect(mockEq2).toHaveBeenCalledWith("is_active", true);
      expect(mockOrder).toHaveBeenCalledWith("name");

      const localFarms = await db.farms.toArray();
      expect(localFarms).toHaveLength(2);
      expect(localFarms[0]?._sync_status).toBe("synced");
      expect(localFarms[1]?._sync_status).toBe("synced");
    });

    it("falls back to Dexie when Supabase errors", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "Network error" } });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      const now = new Date().toISOString();
      await db.farms.bulkAdd([
        {
          id: "farm-local-1",
          org_id: ORG_ID,
          name: "Local Farm A",
          is_active: true,
          created_at: now,
          updated_at: now,
          _sync_status: "pending",
          _local_updated_at: now,
        },
        {
          id: "farm-local-2",
          org_id: ORG_ID,
          name: "Local Farm B",
          is_active: false,
          created_at: now,
          updated_at: now,
          _sync_status: "pending",
          _local_updated_at: now,
        },
      ]);

      const result = await getFarms(ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Local Farm A");
    });
  });

  describe("createFarm", () => {
    it("writes to Supabase and Dexie with synced status", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { id } = await createFarm(ORG_ID, { name: "Nueva Granja", location: "Villavo" });

      expect(id).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          org_id: ORG_ID,
          name: "Nueva Granja",
          location: "Villavo",
          is_active: true,
        }),
      );

      const local = await db.farms.get(id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.name).toBe("Nueva Granja");
    });

    it("adds to outbox when Supabase fails and Dexie has pending status", async () => {
      const mockFrom = await getMockFrom();

      const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const { id } = await createFarm(ORG_ID, { name: "Offline Farm" });

      const local = await db.farms.get(id);
      expect(local?._sync_status).toBe("pending");

      const outbox = await db.sync_outbox.toArray();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        table_name: "farms",
        record_id: id,
        operation: "INSERT",
      });
    });
  });

  describe("updateFarm", () => {
    it("updates in Supabase and Dexie", async () => {
      const mockFrom = await getMockFrom();

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const now = new Date().toISOString();
      await db.farms.add({
        id: "farm-upd",
        org_id: ORG_ID,
        name: "Old Name",
        location: "Old Location",
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      await updateFarm("farm-upd", { name: "Updated", location: "New Location" });

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated", location: "New Location" }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "farm-upd");

      const local = await db.farms.get("farm-upd");
      expect(local?.name).toBe("Updated");
      expect(local?.location).toBe("New Location");
      expect(local?._sync_status).toBe("synced");
    });
  });

  describe("deleteFarm", () => {
    it("sets is_active = false in Supabase and Dexie", async () => {
      const mockFrom = await getMockFrom();

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const now = new Date().toISOString();
      await db.farms.add({
        id: "farm-del",
        org_id: ORG_ID,
        name: "To Delete",
        is_active: true,
        created_at: now,
        updated_at: now,
        _sync_status: "synced",
        _local_updated_at: now,
      });

      await deleteFarm("farm-del");

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(mockEq).toHaveBeenCalledWith("id", "farm-del");

      const local = await db.farms.get("farm-del");
      expect(local?.is_active).toBe(false);
      expect(local?._sync_status).toBe("synced");
    });
  });
});
