import { describe, expect, it } from "vitest";
import { createSacrificioSchema } from "../sacrificio.schema";

const POOL_A = "11111111-1111-1111-8111-111111111111";
const POOL_B = "22222222-2222-2222-8222-222222222222";

const base = {
  pool_id: POOL_A,
  event_date: "2026-04-01",
  groups: [
    {
      size_inches: 12,
      sacrificed_count: 5,
      rejected: [] as { animal_count: number; destination_pool_id: string }[],
    },
  ],
};

describe("createSacrificioSchema", () => {
  it("accepts valid input with only sacrificed", () => {
    const result = createSacrificioSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts rejected rows with distinct destinations", () => {
    const result = createSacrificioSchema.safeParse({
      ...base,
      groups: [
        {
          size_inches: 12,
          sacrificed_count: 1,
          rejected: [
            { animal_count: 2, destination_pool_id: POOL_B },
            { animal_count: 1, destination_pool_id: POOL_A },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate size_inches across groups", () => {
    const result = createSacrificioSchema.safeParse({
      ...base,
      groups: [
        { size_inches: 12, sacrificed_count: 3, rejected: [] },
        { size_inches: 12, sacrificed_count: 2, rejected: [] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate destination_pool_id in the same group", () => {
    const result = createSacrificioSchema.safeParse({
      ...base,
      groups: [
        {
          size_inches: 12,
          sacrificed_count: 0,
          rejected: [
            { animal_count: 2, destination_pool_id: POOL_B },
            { animal_count: 1, destination_pool_id: POOL_B },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects group with zero sacrificed and zero rejected", () => {
    const result = createSacrificioSchema.safeParse({
      ...base,
      groups: [{ size_inches: 12, sacrificed_count: 0, rejected: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event_date in the future (local calendar)", () => {
    const t = new Date();
    t.setDate(t.getDate() + 2);
    const y = t.getFullYear();
    const mo = String(t.getMonth() + 1).padStart(2, "0");
    const da = String(t.getDate()).padStart(2, "0");
    const future = `${y}-${mo}-${da}`;
    const result = createSacrificioSchema.safeParse({
      ...base,
      event_date: future,
    });
    expect(result.success).toBe(false);
  });
});
