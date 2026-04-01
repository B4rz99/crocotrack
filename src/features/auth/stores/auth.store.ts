import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Database } from "@/shared/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthState {
  readonly user: User | null;
  readonly profile: Profile | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly isOwner: boolean;
  readonly isWorker: boolean;
  readonly onboardingCompleted: boolean;
  readonly setSession: (session: Session | null) => void;
  readonly setProfile: (profile: Profile | null) => void;
  readonly setOnboardingCompleted: (completed: boolean) => void;
  readonly setLoading: (isLoading: boolean) => void;
  readonly clear: () => void;
}

const initialState = {
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  isOwner: false,
  isWorker: false,
  onboardingCompleted: false,
} as const;

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  setSession: (session) =>
    set(
      session
        ? { user: session.user, isAuthenticated: true }
        : { user: null, isAuthenticated: false }
    ),

  setProfile: (profile) =>
    set({
      profile,
      isOwner: profile?.role === "owner",
      isWorker: profile?.role === "worker",
    }),

  setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),

  setLoading: (isLoading) => set({ isLoading }),

  clear: () => set({ ...initialState, isLoading: false }),
}));
