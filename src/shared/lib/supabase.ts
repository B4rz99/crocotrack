import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "") as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "") as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: globalThis.localStorage,
  },
});

// Untyped client for dynamic table operations (sync outbox, onboarding batch inserts).
// The typed client requires compile-time table names which is not feasible for dynamic operations.
export const untypedSupabase = supabase as unknown as SupabaseClient;
