import type { Session, User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/shared/types/database.types";
import { useAuthStore } from "../auth.store";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: "access-token",
  refresh_token: "refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 9999999999,
  user: createMockUser(),
  ...overrides,
});

const createMockProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: "user-123",
  email: "test@example.com",
  full_name: "Test User",
  avatar_url: null,
  phone: null,
  role: "owner",
  org_id: "org-123",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("auth store", () => {
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  describe("initial state", () => {
    it("has isAuthenticated as false", () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it("has user as null", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it("has profile as null", () => {
      const state = useAuthStore.getState();
      expect(state.profile).toBeNull();
    });

    it("has isLoading as false after clear", () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setSession", () => {
    it("sets user and isAuthenticated from session", () => {
      const session = createMockSession();
      useAuthStore.getState().setSession(session);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(session.user);
      expect(state.isAuthenticated).toBe(true);
    });

    it("clears user and isAuthenticated when session is null", () => {
      const session = createMockSession();
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setSession(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("setProfile", () => {
    it("updates the profile", () => {
      const profile = createMockProfile();
      useAuthStore.getState().setProfile(profile);

      const state = useAuthStore.getState();
      expect(state.profile).toEqual(profile);
    });

    it("returns isOwner true when profile role is owner", () => {
      const profile = createMockProfile({ role: "owner" });
      useAuthStore.getState().setProfile(profile);

      const state = useAuthStore.getState();
      expect(state.isOwner).toBe(true);
      expect(state.isWorker).toBe(false);
    });

    it("returns isWorker true when profile role is worker", () => {
      const profile = createMockProfile({ role: "worker" });
      useAuthStore.getState().setProfile(profile);

      const state = useAuthStore.getState();
      expect(state.isWorker).toBe(true);
      expect(state.isOwner).toBe(false);
    });

    it("returns isOwner and isWorker false when profile is null", () => {
      const state = useAuthStore.getState();
      expect(state.isOwner).toBe(false);
      expect(state.isWorker).toBe(false);
    });
  });

  describe("clear", () => {
    it("resets to initial state", () => {
      const session = createMockSession();
      const profile = createMockProfile();

      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setProfile(profile);
      useAuthStore.getState().setLoading(false);

      useAuthStore.getState().clear();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("updates isLoading to false", () => {
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("updates isLoading to true", () => {
      useAuthStore.getState().setLoading(false);
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });
});
