import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabase";
import { useAuthStore } from "../stores/auth.store";

async function loadUserData(userId: string) {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  useAuthStore.getState().setProfile(profile);

  if (profile) {
    const { data: org } = await supabase
      .from("organizations")
      .select("onboarding_completed")
      .eq("id", profile.org_id)
      .single();

    useAuthStore.getState().setOnboardingCompleted(org?.onboarding_completed ?? false);
  }
}

export function useAuthListener() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSession(session);

      if (session) {
        loadUserData(session.user.id)
          .catch((err) => console.error("[auth] Failed to load user data:", err))
          .finally(() => {
            useAuthStore.getState().setLoading(false);
          });
      } else {
        useAuthStore.getState().clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}
