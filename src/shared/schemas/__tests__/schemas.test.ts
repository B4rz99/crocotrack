import { describe, expect, it } from "vitest";
import { createFarmSchema } from "../farm.schema";
import { createFoodTypeSchema } from "../food-type.schema";
import { createIncubatorSchema } from "../incubator.schema";
import { createOrgSchema } from "../org.schema";
import { createPoolSchema } from "../pool.schema";

describe("createOrgSchema", () => {
  it("validates valid org data", () => {
    const result = createOrgSchema.safeParse({
      name: "Criadero El Caimán",
      country: "CO",
      currency: "COP",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createOrgSchema.safeParse({
      name: "",
      country: "CO",
      currency: "COP",
    });
    expect(result.success).toBe(false);
  });
});

describe("createFarmSchema", () => {
  it("validates valid farm data", () => {
    const result = createFarmSchema.safeParse({
      name: "Finca La Esperanza",
      location: "Córdoba, Colombia",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createFarmSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createPoolSchema", () => {
  it("validates crianza pool", () => {
    const result = createPoolSchema.safeParse({
      name: "Pileta 1",
      pool_type: "crianza",
      capacity: 200,
    });
    expect(result.success).toBe(true);
  });

  it("validates reproductor pool", () => {
    const result = createPoolSchema.safeParse({
      name: "Pozo A",
      pool_type: "reproductor",
      capacity: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid pool type", () => {
    const result = createPoolSchema.safeParse({
      name: "P1",
      pool_type: "invalid",
      capacity: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative capacity", () => {
    const result = createPoolSchema.safeParse({
      name: "P1",
      pool_type: "crianza",
      capacity: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("createIncubatorSchema", () => {
  it("validates valid incubator", () => {
    const result = createIncubatorSchema.safeParse({
      name: "Incubador Principal",
      capacity: 500,
    });
    expect(result.success).toBe(true);
  });
});

describe("createFoodTypeSchema", () => {
  it("validates valid food type", () => {
    const result = createFoodTypeSchema.safeParse({
      name: "Pollo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createFoodTypeSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
