import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";

vi.mock("../supabase", () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
    },
    __mockFrom: mockFrom,
  };
});

import { addToOutbox, flushOutbox, getPendingCount, markSynced } from "../sync";

async function getSuppabaseMockFrom() {
  const mod = await import("../supabase");
  return (mod as unknown as { __mockFrom: ReturnType<typeof vi.fn> }).__mockFrom;
}

describe("Sync Engine", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getSuppabaseMockFrom();
    mockFrom.mockReset();
  });

  describe("addToOutbox", () => {
    it("adds an entry to the sync_outbox table", async () => {
      await addToOutbox("farms", "farm-1", "INSERT", { name: "Test Farm" });

      const entries = await db.sync_outbox.toArray();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        table_name: "farms",
        record_id: "farm-1",
        operation: "INSERT",
        payload: { name: "Test Farm" },
        retry_count: 0,
      });
      expect(entries[0]?.created_at).toBeDefined();
    });

    it("adds multiple entries for different operations", async () => {
      await addToOutbox("farms", "farm-1", "INSERT", { name: "Farm A" });
      await addToOutbox("pools", "pool-1", "UPDATE", { name: "Pool A" });
      await addToOutbox("farms", "farm-2", "DELETE", {});

      const entries = await db.sync_outbox.toArray();
      expect(entries).toHaveLength(3);
    });

    it("stores the current timestamp as created_at", async () => {
      const before = new Date().toISOString();
      await addToOutbox("farms", "farm-1", "INSERT", { name: "Farm" });
      const after = new Date().toISOString();

      const entries = await db.sync_outbox.toArray();
      const createdAt = entries[0]?.created_at ?? "";
      expect(createdAt >= before).toBe(true);
      expect(createdAt <= after).toBe(true);
    });

    it("initializes retry_count to 0", async () => {
      await addToOutbox("organizations", "org-1", "UPDATE", { name: "Org" });

      const entries = await db.sync_outbox.toArray();
      expect(entries[0]?.retry_count).toBe(0);
    });
  });

  describe("getPendingCount", () => {
    it("returns 0 when outbox is empty", async () => {
      const count = await getPendingCount();
      expect(count).toBe(0);
    });

    it("returns the correct count of pending entries", async () => {
      await addToOutbox("farms", "farm-1", "INSERT", { name: "Farm A" });
      await addToOutbox("farms", "farm-2", "INSERT", { name: "Farm B" });
      await addToOutbox("pools", "pool-1", "UPDATE", { name: "Pool A" });

      const count = await getPendingCount();
      expect(count).toBe(3);
    });
  });

  describe("markSynced", () => {
    it("updates _sync_status to synced on the specified record", async () => {
      await db.farms.add({
        id: "farm-1",
        org_id: "org-1",
        name: "Test Farm",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await markSynced("farms", "farm-1");

      const farm = await db.farms.get("farm-1");
      expect(farm?._sync_status).toBe("synced");
    });

    it("updates _sync_status on organizations table", async () => {
      await db.organizations.add({
        id: "org-1",
        name: "Test Org",
        slug: "test-org",
        country: "CO",
        currency: "COP",
        settings: {},
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await markSynced("organizations", "org-1");

      const org = await db.organizations.get("org-1");
      expect(org?._sync_status).toBe("synced");
    });
  });

  describe("flushOutbox", () => {
    it("processes outbox entries by calling supabase upsert for INSERT operations", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert, delete: vi.fn() });

      await db.farms.add({
        id: "farm-1",
        org_id: "org-1",
        name: "Test Farm",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await addToOutbox("farms", "farm-1", "INSERT", { id: "farm-1", name: "Test Farm" });

      await flushOutbox();

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockUpsert).toHaveBeenCalledWith({ id: "farm-1", name: "Test Farm" });

      const remaining = await db.sync_outbox.toArray();
      expect(remaining).toHaveLength(0);
    });

    it("processes outbox entries by calling supabase upsert for UPDATE operations", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert, delete: vi.fn() });

      await db.farms.add({
        id: "farm-1",
        org_id: "org-1",
        name: "Updated Farm",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await addToOutbox("farms", "farm-1", "UPDATE", { id: "farm-1", name: "Updated Farm" });

      await flushOutbox();

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockUpsert).toHaveBeenCalledWith({ id: "farm-1", name: "Updated Farm" });
    });

    it("processes DELETE operations by calling supabase delete", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ upsert: vi.fn(), delete: mockDelete });

      await addToOutbox("farms", "farm-1", "DELETE", {});

      await flushOutbox();

      expect(mockFrom).toHaveBeenCalledWith("farms");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "farm-1");

      const remaining = await db.sync_outbox.toArray();
      expect(remaining).toHaveLength(0);
    });

    it("marks local record as synced after successful flush", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert, delete: vi.fn() });

      await db.pools.add({
        id: "pool-1",
        org_id: "org-1",
        farm_id: "farm-1",
        name: "Test Pool",
        pool_type: "crianza",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await addToOutbox("pools", "pool-1", "INSERT", { id: "pool-1", name: "Test Pool" });

      await flushOutbox();

      const pool = await db.pools.get("pool-1");
      expect(pool?._sync_status).toBe("synced");
    });

    it("does not remove entry and increments retry_count on failure", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      const mockUpsert = vi.fn().mockResolvedValue({ error: { message: "Network error" } });
      mockFrom.mockReturnValue({ upsert: mockUpsert, delete: vi.fn() });

      await db.farms.add({
        id: "farm-1",
        org_id: "org-1",
        name: "Test Farm",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await addToOutbox("farms", "farm-1", "INSERT", { id: "farm-1", name: "Test Farm" });

      await flushOutbox();

      const remaining = await db.sync_outbox.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.retry_count).toBe(1);
    });

    it("processes multiple entries and handles mixed success/failure", async () => {
      const mockFrom = await getSuppabaseMockFrom();
      let callCount = 0;
      const mockUpsert = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: { message: "Server error" } });
      });
      mockFrom.mockReturnValue({ upsert: mockUpsert, delete: vi.fn() });

      await db.farms.add({
        id: "farm-1",
        org_id: "org-1",
        name: "Farm A",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await db.farms.add({
        id: "farm-2",
        org_id: "org-1",
        name: "Farm B",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _sync_status: "pending",
        _local_updated_at: new Date().toISOString(),
      });

      await addToOutbox("farms", "farm-1", "INSERT", { id: "farm-1", name: "Farm A" });
      await addToOutbox("farms", "farm-2", "INSERT", { id: "farm-2", name: "Farm B" });

      await flushOutbox();

      const remaining = await db.sync_outbox.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.record_id).toBe("farm-2");
      expect(remaining[0]?.retry_count).toBe(1);
    });

    it("does nothing when outbox is empty", async () => {
      const mockFrom = await getSuppabaseMockFrom();

      await flushOutbox();

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
