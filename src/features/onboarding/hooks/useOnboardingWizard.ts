import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";
import type { CreateOrgInput } from "@/shared/schemas/org.schema";
import type { CreatePoolInput } from "@/shared/schemas/pool.schema";
import { submitOnboarding } from "../api/onboarding.api";
import { useOnboardingStore } from "../stores/onboarding.store";

interface FarmData {
  readonly name: string;
  readonly location?: string;
}

export function useOnboardingWizard() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    currentStep,
    setOrgData,
    setFarmData,
    setPoolsData,
    setFoodTypesData,
    setIncubatorsData,
    addInviteEmail,
    nextStep,
    prevStep,
    reset,
  } = useOnboardingStore();

  const handleOrgNext = useCallback(
    (data: CreateOrgInput) => {
      setOrgData(data);
      nextStep();
    },
    [setOrgData, nextStep],
  );

  const handleFarmNext = useCallback(
    (data: FarmData) => {
      setFarmData(data);
      nextStep();
    },
    [setFarmData, nextStep],
  );

  const handleFoodTypesNext = useCallback(
    (data: readonly CreateFoodTypeInput[]) => {
      setFoodTypesData(data);
      nextStep();
    },
    [setFoodTypesData, nextStep],
  );

  const handlePoolsNext = useCallback(
    (data: readonly CreatePoolInput[]) => {
      setPoolsData(data);
      nextStep();
    },
    [setPoolsData, nextStep],
  );

  const handleIncubatorsNext = useCallback(
    (data: readonly CreateIncubatorInput[]) => {
      setIncubatorsData(data);
      nextStep();
    },
    [setIncubatorsData, nextStep],
  );

  const handleComplete = useCallback(
    async (emails: readonly string[]) => {
      for (const email of emails) {
        addInviteEmail(email);
      }

      const state = useOnboardingStore.getState();
      if (!state.orgData || !state.farmData) return;
      if (!profile?.org_id || !profile.id) return;

      setIsSubmitting(true);
      setError(null);

      try {
        await submitOnboarding(
          {
            orgData: state.orgData,
            farmData: state.farmData,
            foodTypesData: state.foodTypesData,
            poolsData: state.poolsData,
            incubatorsData: state.incubatorsData,
            inviteEmails: emails,
          },
          profile.org_id,
          profile.id,
        );

        useAuthStore.getState().setOnboardingCompleted(true);
        reset();
        navigate(ROUTES.DASHBOARD);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [addInviteEmail, profile, reset, navigate],
  );

  return {
    currentStep,
    isSubmitting,
    error,
    handleOrgNext,
    handleFarmNext,
    handleFoodTypesNext,
    handlePoolsNext,
    handleIncubatorsNext,
    handleComplete,
    prevStep,
  } as const;
}
