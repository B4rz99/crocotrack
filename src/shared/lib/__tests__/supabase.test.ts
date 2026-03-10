import { describe, expect, it } from "vitest";

describe("supabase client", () => {
  it("creates a supabase client instance", async () => {
    const { supabase } = await import("../supabase");
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(supabase.from).toBeDefined();
  });
});
