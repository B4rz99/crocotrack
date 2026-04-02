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
import { createFoodPurchase, getFoodPurchasesByFarm, getFoodStockByFarm } from "../food-stock.api";

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
const FOOD_TYPE_ID = "44444444-4444-4444-8444-444444444444";

describe("food-stock.api", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const mockFrom = await getMockFrom();
    const mockRpc = await getMockRpc();
    mockFrom.mockReset();
    mockRpc.mockReset();
    vi.mocked(addToOutbox).mockReset();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("getFoodStockByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [
        {
          id: "stock-001",
          org_id: ORG_ID,
          farm_id: FARM_ID,
          food_type_id: FOOD_TYPE_ID,
          current_quantity: 150.5,
          low_stock_threshold: 20,
          created_at: "2026-04-02T10:00:00.000Z",
          updated_at: "2026-04-02T10:00:00.000Z",
          food_types: { name: "Pollo", unit: "kg" },
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqFarmId = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getFoodStockByFarm(FARM_ID);

      expect(mockFrom).toHaveBeenCalledWith("food_stock");
      expect(result).toEqual(mockData);

      const cached = await db.food_stock.get("stock-001");
      expect(cached).toBeDefined();
      expect(cached?._sync_status).toBe("synced");
      expect(cached?.current_quantity).toBe(150.5);
    });

    it("falls back to Dexie on Supabase error", async () => {
      const mockFrom = await getMockFrom();

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
      const mockEqFarmId = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      await db.food_stock.add({
        id: "stock-local",
        org_id: ORG_ID,
        farm_id: FARM_ID,
        food_type_id: FOOD_TYPE_ID,
        current_quantity: 50,
        created_at: "2026-04-02T10:00:00.000Z",
        updated_at: "2026-04-02T10:00:00.000Z",
        _sync_status: "synced",
        _local_updated_at: "2026-04-02T10:00:00.000Z",
      });

      const result = await getFoodStockByFarm(FARM_ID);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("stock-local");
    });
  });

  describe("createFoodPurchase", () => {
    const baseInput = {
      food_type_id: FOOD_TYPE_ID,
      purchase_date: "2026-04-02",
      quantity_kg: 100,
    };

    it("calls RPC and writes synced record to Dexie on success", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "purchase-id", error: null });

      const result = await createFoodPurchase(ORG_ID, FARM_ID, baseInput);

      expect(result.id).toBeDefined();
      expect(mockRpc).toHaveBeenCalledWith(
        "create_food_purchase",
        expect.objectContaining({
          p_org_id: ORG_ID,
          p_farm_id: FARM_ID,
          p_food_type_id: FOOD_TYPE_ID,
          p_purchase_date: "2026-04-02",
          p_quantity_kg: 100,
          p_supplier: null,
          p_notes: null,
        })
      );

      const local = await db.food_purchases.get(result.id);
      expect(local).toBeDefined();
      expect(local?._sync_status).toBe("synced");
      expect(local?.quantity_kg).toBe(100);

      expect(addToOutbox).not.toHaveBeenCalled();
    });

    it("queues RPC to outbox on Supabase failure", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: null, error: { message: "network error" } });

      const result = await createFoodPurchase(ORG_ID, FARM_ID, baseInput);

      const local = await db.food_purchases.get(result.id);
      expect(local?._sync_status).toBe("pending");

      expect(addToOutbox).toHaveBeenCalledWith(
        "create_food_purchase",
        result.id,
        "RPC",
        expect.objectContaining({
          p_id: result.id,
          _entity_table: "food_purchases",
        })
      );
    });

    it("passes supplier and notes when provided", async () => {
      const mockRpc = await getMockRpc();
      mockRpc.mockResolvedValue({ data: "id", error: null });

      await createFoodPurchase(ORG_ID, FARM_ID, {
        ...baseInput,
        supplier: "Proveedor ABC",
        notes: "Compra mensual",
      });

      expect(mockRpc).toHaveBeenCalledWith(
        "create_food_purchase",
        expect.objectContaining({
          p_supplier: "Proveedor ABC",
          p_notes: "Compra mensual",
        })
      );
    });
  });

  describe("getFoodPurchasesByFarm", () => {
    it("returns data from Supabase and caches to Dexie", async () => {
      const mockFrom = await getMockFrom();
      const mockData = [
        {
          id: "purch-001",
          org_id: ORG_ID,
          farm_id: FARM_ID,
          food_type_id: FOOD_TYPE_ID,
          purchase_date: "2026-04-01",
          quantity_kg: 200,
          supplier: "Proveedor XYZ",
          notes: null,
          is_active: true,
          created_at: "2026-04-01T10:00:00.000Z",
          updated_at: "2026-04-01T10:00:00.000Z",
          created_by: null,
          food_types: { name: "Pollo", unit: "kg" },
          profiles: { full_name: "Ana Martinez" },
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEqIsActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqFarmId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFarmId });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getFoodPurchasesByFarm(FARM_ID);
      expect(result).toEqual(mockData);

      const cached = await db.food_purchases.get("purch-001");
      expect(cached?._sync_status).toBe("synced");
    });
  });
});
