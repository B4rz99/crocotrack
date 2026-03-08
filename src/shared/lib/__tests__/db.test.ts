import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";

describe("CrocoTrackDB", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("has all required tables", () => {
    expect(db.organizations).toBeDefined();
    expect(db.farms).toBeDefined();
    expect(db.pools).toBeDefined();
    expect(db.incubators).toBeDefined();
    expect(db.food_types).toBeDefined();
    expect(db.sync_outbox).toBeDefined();
  });

  it("can add and retrieve an organization", async () => {
    const org = {
      id: "test-org-id",
      name: "Test Org",
      slug: "test-org",
      country: "CO",
      currency: "COP",
      settings: {},
      onboarding_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: "pending" as const,
      _local_updated_at: new Date().toISOString(),
    };

    await db.organizations.add(org);
    const retrieved = await db.organizations.get("test-org-id");
    expect(retrieved?.name).toBe("Test Org");
    expect(retrieved?._sync_status).toBe("pending");
  });

  it("can query pending sync items", async () => {
    await db.sync_outbox.add({
      table_name: "farms",
      record_id: "farm-1",
      operation: "INSERT",
      payload: { name: "Test Farm" },
      created_at: new Date().toISOString(),
      retry_count: 0,
    });

    const pending = await db.sync_outbox.toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.table_name).toBe("farms");
  });
});
