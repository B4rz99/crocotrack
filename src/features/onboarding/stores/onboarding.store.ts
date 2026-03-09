import { create } from "zustand";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";
import type { CreateOrgInput } from "@/shared/schemas/org.schema";
import type { CreatePoolInput } from "@/shared/schemas/pool.schema";

interface FarmData {
  readonly name: string;
  readonly location?: string;
}

const TOTAL_STEPS = 6;
const MAX_STEP = TOTAL_STEPS - 1;

interface OnboardingState {
  readonly currentStep: number;
  readonly orgData: CreateOrgInput | null;
  readonly farmData: FarmData | null;
  readonly poolsData: readonly CreatePoolInput[];
  readonly incubatorsData: readonly CreateIncubatorInput[];
  readonly foodTypesData: readonly CreateFoodTypeInput[];
  readonly inviteEmails: readonly string[];
  readonly setOrgData: (data: CreateOrgInput) => void;
  readonly setFarmData: (data: FarmData) => void;
  readonly setPoolsData: (pools: readonly CreatePoolInput[]) => void;
  readonly addPool: (pool: CreatePoolInput) => void;
  readonly removePool: (index: number) => void;
  readonly setFoodTypesData: (foodTypes: readonly CreateFoodTypeInput[]) => void;
  readonly addFoodType: (foodType: CreateFoodTypeInput) => void;
  readonly removeFoodType: (index: number) => void;
  readonly setIncubatorsData: (data: readonly CreateIncubatorInput[]) => void;
  readonly addInviteEmail: (email: string) => void;
  readonly removeInviteEmail: (index: number) => void;
  readonly nextStep: () => void;
  readonly prevStep: () => void;
  readonly reset: () => void;
}

const initialState = {
  currentStep: 0,
  orgData: null,
  farmData: null,
  poolsData: [] as readonly CreatePoolInput[],
  incubatorsData: [] as readonly CreateIncubatorInput[],
  foodTypesData: [] as readonly CreateFoodTypeInput[],
  inviteEmails: [] as readonly string[],
} as const;

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setOrgData: (data) => set({ orgData: data }),

  setFarmData: (data) => set({ farmData: data }),

  setPoolsData: (pools) => set({ poolsData: pools }),

  addPool: (pool) => set((state) => ({ poolsData: [...state.poolsData, pool] })),

  removePool: (index) =>
    set((state) => ({
      poolsData: state.poolsData.filter((_, i) => i !== index),
    })),

  setFoodTypesData: (foodTypes) => set({ foodTypesData: foodTypes }),

  addFoodType: (foodType) =>
    set((state) => ({ foodTypesData: [...state.foodTypesData, foodType] })),

  removeFoodType: (index) =>
    set((state) => ({
      foodTypesData: state.foodTypesData.filter((_, i) => i !== index),
    })),

  setIncubatorsData: (data) => set({ incubatorsData: data }),

  addInviteEmail: (email) => set((state) => ({ inviteEmails: [...state.inviteEmails, email] })),

  removeInviteEmail: (index) =>
    set((state) => ({
      inviteEmails: state.inviteEmails.filter((_, i) => i !== index),
    })),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, MAX_STEP),
    })),

  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),

  reset: () => set({ ...initialState }),
}));
