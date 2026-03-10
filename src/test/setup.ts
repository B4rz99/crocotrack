import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// Provide Supabase env vars for tests (createClient requires non-empty values)
import.meta.env.VITE_SUPABASE_URL ||= "https://test.supabase.co";
import.meta.env.VITE_SUPABASE_ANON_KEY ||= "test-anon-key";
