import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FarmState {
  readonly lastFarmId: string | null;
  readonly setLastFarmId: (farmId: string) => void;
  readonly clear: () => void;
}

export const useFarmStore = create<FarmState>()(
  persist(
    (set) => ({
      lastFarmId: null,
      setLastFarmId: (farmId) => set({ lastFarmId: farmId }),
      clear: () => set({ lastFarmId: null }),
    }),
    {
      name: "crocotrack-farm",
    }
  )
);
