import { useEffect, useRef } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuthStore } from "../stores/auth.store";

export function useAuthListener() {
  const activeUserId = useRef<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      activeUserId.current = userId;
      useAuthStore.getState().setSession(session);

      if (session && userId) {
        loadUserData(userId, activeUserId)
          .catch((err) => console.error("[auth] Failed to load user data:", err))
          .finally(() => {
            if (activeUserId.current === userId) {
              useAuthStore.getState().setLoading(false);
            }
          });
      } else {
        useAuthStore.getState().clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

async function loadUserData(userId: string, activeUserId: React.RefObject<string | null>) {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  if (activeUserId.current !== userId) return;
  useAuthStore.getState().setProfile(profile);

  if (profile) {
    const { data: org } = await supabase
      .from("organizations")
      .select("onboarding_completed")
      .eq("id", profile.org_id)
      .single();

    if (activeUserId.current !== userId) return;
    useAuthStore.getState().setOnboardingCompleted(org?.onboarding_completed ?? false);
  }
}
