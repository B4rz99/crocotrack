import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

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
import type { CreateFarmInput } from "@/shared/schemas/farm.schema";
import { createFarm, deleteFarm, getFarms } from "../farms.api";

const ORG_ID = "org-test-001";
const FARM_ID = "farm-test-001";

const makeFarmRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: FARM_ID,
  org_id: ORG_ID,
  name: "Granja Norte",
  location: "Sincelejo",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const getMockFrom = async (): Promise<MockInstance> => {
  const mod = await import("@/shared/lib/supabase");
  return (mod as unknown as { __mockFrom: MockInstance }).__mockFrom;
};

const getMockAddToOutbox = async (): Promise<MockInstance> => {
  const mod = await import("@/shared/lib/sync");
  return mod.addToOutbox as unknown as MockInstance;
};

describe("farms.api", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  describe("getFarms", () => {
    it("returns data from Supabase and populates Dexie", async () => {
      const mockFrom = await getMockFrom();
      const farms = [makeFarmRow(), makeFarmRow({ id: "farm-test-002", name: "Granja Sur" })];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: farms, error: null }),
            }),
          }),
        }),
      });

      const result = await getFarms(ORG_ID);

      expect(result).toEqual(farms);
      expect(mockFrom).toHaveBeenCalledWith("farms");

      const localFarms = await db.farms.toArray();
      expect(localFarms).toHaveLength(2);
      expect(localFarms[0]?._sync_status).toBe("synced");
      expect(localFarms[1]?._sync_status).toBe("synced");
    });

    it("falls back to Dexie when Supabase errors", async () => {
      const mockFrom = await getMockFrom();

      await db.farms.put({
        ...makeFarmRow(),
        location: "Sincelejo",
        _sync_status: "synced",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "network error" },
              }),
            }),
          }),
        }),
      });

      const result = await getFarms(ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Granja Norte");
    });
  });

  describe("createFarm", () => {
    it("writes to Supabase and Dexie on success", async () => {
      const mockFrom = await getMockFrom();
      const mockAddToOutbox = await getMockAddToOutbox();

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const input: CreateFarmInput = { name: "Granja Nueva", location: "Monteria" };
      const result = await createFarm(ORG_ID, input);

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("string");

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: ORG_ID,
          name: "Granja Nueva",
          location: "Monteria",
          is_active: true,
        })
      );

      const localFarm = await db.farms.get(result.id);
      expect(localFarm).toBeDefined();
      expect(localFarm?.name).toBe("Granja Nueva");
      expect(localFarm?._sync_status).toBe("synced");

      expect(mockAddToOutbox).not.toHaveBeenCalled();
    });

    it("adds to outbox when Supabase fails", async () => {
      const mockFrom = await getMockFrom();
      const mockAddToOutbox = await getMockAddToOutbox();

      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: "insert failed" },
      });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const input: CreateFarmInput = { name: "Granja Offline" };
      const result = await createFarm(ORG_ID, input);

      const localFarm = await db.farms.get(result.id);
      expect(localFarm?._sync_status).toBe("pending");

      expect(mockAddToOutbox).toHaveBeenCalledWith(
        "farms",
        result.id,
        "INSERT",
        expect.objectContaining({
          id: result.id,
          org_id: ORG_ID,
          name: "Granja Offline",
          is_active: true,
        })
      );
    });
  });

  describe("deleteFarm", () => {
    it("sets is_active to false (soft delete)", async () => {
      const mockFrom = await getMockFrom();

      await db.farms.put({
        ...makeFarmRow(),
        location: "Sincelejo",
        _sync_status: "synced",
        _local_updated_at: "2026-01-01T00:00:00.000Z",
      });

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await deleteFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(mockEq).toHaveBeenCalledWith("id", FARM_ID);

      const localFarm = await db.farms.get(FARM_ID);
      expect(localFarm?.is_active).toBe(false);
      expect(localFarm?._sync_status).toBe("synced");
    });
  });
});
