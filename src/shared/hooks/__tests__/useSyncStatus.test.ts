import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { useSyncStatus } from "../useSyncStatus";

describe("useSyncStatus", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("returns pendingCount as 0 when outbox is empty", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await act(async () => {});

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.hasPending).toBe(false);
  });

  it("reflects outbox count reactively", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await act(async () => {
      await db.sync_outbox.add({
        table_name: "farms",
        record_id: "farm-1",
        operation: "INSERT",
        payload: { name: "Test" },
        created_at: new Date().toISOString(),
        retry_count: 0,
      });
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.hasPending).toBe(true);

    await act(async () => {
      await db.sync_outbox.clear();
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.hasPending).toBe(false);
  });
});
