import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/sync", () => ({
  getPendingCount: vi.fn().mockResolvedValue(0),
}));

import { useSyncStatus } from "../useSyncStatus";

async function getMockGetPendingCount() {
  const mod = await import("../../lib/sync");
  return mod.getPendingCount as ReturnType<typeof vi.fn>;
}

const flushPromises = () => act(async () => {});

describe("useSyncStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    const mock = await getMockGetPendingCount();
    mock.mockReset();
    mock.mockResolvedValue(0);
  });

  it("returns pendingCount as 0 initially after loading", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await flushPromises();

    expect(result.current.pendingCount).toBe(0);
  });

  it("returns isSyncing as false when pendingCount is 0", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await flushPromises();

    expect(result.current.isSyncing).toBe(false);
  });

  it("returns isSyncing as true when pendingCount > 0", async () => {
    const mock = await getMockGetPendingCount();
    mock.mockResolvedValue(3);

    const { result } = renderHook(() => useSyncStatus());

    await flushPromises();

    expect(result.current.pendingCount).toBe(3);
    expect(result.current.isSyncing).toBe(true);
  });

  it("polls for pending count on interval", async () => {
    const mock = await getMockGetPendingCount();
    mock.mockResolvedValue(0);

    const { result } = renderHook(() => useSyncStatus());

    await flushPromises();

    expect(result.current.pendingCount).toBe(0);

    mock.mockResolvedValue(5);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.pendingCount).toBe(5);
    expect(result.current.isSyncing).toBe(true);
  });

  it("cleans up interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = renderHook(() => useSyncStatus());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
