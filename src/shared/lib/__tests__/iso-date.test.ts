import { describe, expect, it } from "vitest";
import { addDaysIsoUtc, isoDateUtcNotAfterToday, todayIsoDateUtc } from "../iso-date";

describe("iso-date", () => {
  it("isoDateUtcNotAfterToday accepts today in UTC", () => {
    expect(isoDateUtcNotAfterToday(todayIsoDateUtc())).toBe(true);
  });

  it("isoDateUtcNotAfterToday rejects invalid format", () => {
    expect(isoDateUtcNotAfterToday("04-04-2026")).toBe(false);
  });

  it("isoDateUtcNotAfterToday rejects invalid calendar dates that Date.UTC would normalise", () => {
    expect(isoDateUtcNotAfterToday("2024-02-31")).toBe(false);
    expect(isoDateUtcNotAfterToday("2024-13-01")).toBe(false);
    expect(isoDateUtcNotAfterToday("2024-00-15")).toBe(false);
    expect(isoDateUtcNotAfterToday("2024-01-00")).toBe(false);
  });

  it("addDaysIsoUtc adds calendar days in UTC without local TZ drift", () => {
    expect(addDaysIsoUtc("2024-01-15", 7)).toBe("2024-01-22");
  });
});
