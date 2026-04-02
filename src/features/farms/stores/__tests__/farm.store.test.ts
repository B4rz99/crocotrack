import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useFarmStore } from "../farm.store";

describe("useFarmStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useFarmStore.setState({ lastFarmId: null });
  });

  afterEach(() => {
    useFarmStore.setState({ lastFarmId: null });
    localStorage.clear();
  });

  describe("initial state", () => {
    it("has lastFarmId as null", () => {
      expect(useFarmStore.getState().lastFarmId).toBeNull();
    });
  });

  describe("setLastFarmId", () => {
    it("updates lastFarmId", () => {
      useFarmStore.getState().setLastFarmId("farm-123");
      expect(useFarmStore.getState().lastFarmId).toBe("farm-123");
    });

    it("overwrites a previous value", () => {
      useFarmStore.getState().setLastFarmId("farm-1");
      useFarmStore.getState().setLastFarmId("farm-2");
      expect(useFarmStore.getState().lastFarmId).toBe("farm-2");
    });
  });

  describe("clear", () => {
    it("resets lastFarmId to null", () => {
      useFarmStore.getState().setLastFarmId("farm-123");
      useFarmStore.getState().clear();
      expect(useFarmStore.getState().lastFarmId).toBeNull();
    });
  });

  describe("localStorage persistence", () => {
    it("writes lastFarmId to localStorage", () => {
      useFarmStore.getState().setLastFarmId("farm-456");
      const stored = JSON.parse(localStorage.getItem("crocotrack-farm") ?? "{}");
      expect(stored.state.lastFarmId).toBe("farm-456");
    });

    it("clears localStorage entry on clear()", () => {
      useFarmStore.getState().setLastFarmId("farm-456");
      useFarmStore.getState().clear();
      const stored = JSON.parse(localStorage.getItem("crocotrack-farm") ?? "{}");
      expect(stored.state?.lastFarmId).toBeNull();
    });
  });
});
