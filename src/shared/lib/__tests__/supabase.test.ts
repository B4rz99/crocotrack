import { describe, expect, it } from "vitest";
import { supabase } from "../supabase";

describe("supabase client", () => {
  it("creates a supabase client instance", () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(supabase.from).toBeDefined();
  });
});
