import { afterEach, describe, expect, it } from "vitest";
import { useOnboardingStore } from "../onboarding.store";

describe("onboarding store", () => {
  afterEach(() => {
    useOnboardingStore.getState().reset();
  });

  describe("initial state", () => {
    it("has currentStep as 0", () => {
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it("has orgData as null", () => {
      expect(useOnboardingStore.getState().orgData).toBeNull();
    });

    it("has farmData as null", () => {
      expect(useOnboardingStore.getState().farmData).toBeNull();
    });

    it("has poolsData as empty array", () => {
      expect(useOnboardingStore.getState().poolsData).toEqual([]);
    });

    it("has incubatorsData as empty array", () => {
      expect(useOnboardingStore.getState().incubatorsData).toEqual([]);
    });

    it("has foodTypesData as empty array", () => {
      expect(useOnboardingStore.getState().foodTypesData).toEqual([]);
    });

    it("has cleaningProductsData as empty array", () => {
      expect(useOnboardingStore.getState().cleaningProductsData).toEqual([]);
    });

    it("has cleaningFrequencyDays as null", () => {
      expect(useOnboardingStore.getState().cleaningFrequencyDays).toBeNull();
    });

    it("has inviteEmails as empty array", () => {
      expect(useOnboardingStore.getState().inviteEmails).toEqual([]);
    });
  });

  describe("setOrgData", () => {
    it("stores org data", () => {
      const orgData = { name: "My Org", country: "CO", currency: "COP" };
      useOnboardingStore.getState().setOrgData(orgData);

      expect(useOnboardingStore.getState().orgData).toEqual(orgData);
    });
  });

  describe("setFarmData", () => {
    it("stores farm data", () => {
      const farmData = { name: "My Farm", location: "Somewhere" };
      useOnboardingStore.getState().setFarmData(farmData);

      expect(useOnboardingStore.getState().farmData).toEqual(farmData);
    });
  });

  describe("addPool / removePool", () => {
    it("adds a pool to the list", () => {
      const pool = { name: "Pool 1", pool_type: "crianza" as const, capacity: 50 };
      useOnboardingStore.getState().addPool(pool);

      expect(useOnboardingStore.getState().poolsData).toEqual([pool]);
    });

    it("adds multiple pools", () => {
      const pool1 = { name: "Pool 1", pool_type: "crianza" as const, capacity: 50 };
      const pool2 = { name: "Pool 2", pool_type: "reproductor" as const, capacity: 30 };
      useOnboardingStore.getState().addPool(pool1);
      useOnboardingStore.getState().addPool(pool2);

      expect(useOnboardingStore.getState().poolsData).toEqual([pool1, pool2]);
    });

    it("removes a pool by index", () => {
      const pool1 = { name: "Pool 1", pool_type: "crianza" as const, capacity: 50 };
      const pool2 = { name: "Pool 2", pool_type: "reproductor" as const, capacity: 30 };
      useOnboardingStore.getState().addPool(pool1);
      useOnboardingStore.getState().addPool(pool2);
      useOnboardingStore.getState().removePool(0);

      expect(useOnboardingStore.getState().poolsData).toEqual([pool2]);
    });
  });

  describe("addFoodType / removeFoodType", () => {
    it("adds a food type to the list", () => {
      const foodType = { name: "Pollo", unit: "kg" };
      useOnboardingStore.getState().addFoodType(foodType);

      expect(useOnboardingStore.getState().foodTypesData).toEqual([foodType]);
    });

    it("adds multiple food types", () => {
      const ft1 = { name: "Pollo", unit: "kg" };
      const ft2 = { name: "Pescado", unit: "kg" };
      useOnboardingStore.getState().addFoodType(ft1);
      useOnboardingStore.getState().addFoodType(ft2);

      expect(useOnboardingStore.getState().foodTypesData).toEqual([ft1, ft2]);
    });

    it("removes a food type by index", () => {
      const ft1 = { name: "Pollo", unit: "kg" };
      const ft2 = { name: "Pescado", unit: "kg" };
      useOnboardingStore.getState().addFoodType(ft1);
      useOnboardingStore.getState().addFoodType(ft2);
      useOnboardingStore.getState().removeFoodType(0);

      expect(useOnboardingStore.getState().foodTypesData).toEqual([ft2]);
    });
  });

  describe("setIncubatorsData", () => {
    it("stores incubator config", () => {
      const incubators = [{ name: "Incubadora 1", capacity: 100 }];
      useOnboardingStore.getState().setIncubatorsData(incubators);

      expect(useOnboardingStore.getState().incubatorsData).toEqual(incubators);
    });
  });

  describe("addInviteEmail / removeInviteEmail", () => {
    it("adds an invite email", () => {
      useOnboardingStore.getState().addInviteEmail("user@example.com");

      expect(useOnboardingStore.getState().inviteEmails).toEqual(["user@example.com"]);
    });

    it("adds multiple invite emails", () => {
      useOnboardingStore.getState().addInviteEmail("a@example.com");
      useOnboardingStore.getState().addInviteEmail("b@example.com");

      expect(useOnboardingStore.getState().inviteEmails).toEqual([
        "a@example.com",
        "b@example.com",
      ]);
    });

    it("removes an invite email by index", () => {
      useOnboardingStore.getState().addInviteEmail("a@example.com");
      useOnboardingStore.getState().addInviteEmail("b@example.com");
      useOnboardingStore.getState().removeInviteEmail(0);

      expect(useOnboardingStore.getState().inviteEmails).toEqual(["b@example.com"]);
    });
  });

  describe("nextStep / prevStep", () => {
    it("increments currentStep", () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it("does not exceed max step (7)", () => {
      for (let i = 0; i < 20; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(7);
    });

    it("decrements currentStep", () => {
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it("does not go below 0", () => {
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  describe("reset", () => {
    it("resets to initial state", () => {
      useOnboardingStore.getState().setOrgData({ name: "Org", country: "CO", currency: "COP" });
      useOnboardingStore.getState().setFarmData({ name: "Farm" });
      useOnboardingStore.getState().addPool({ name: "P", pool_type: "crianza", capacity: 10 });
      useOnboardingStore.getState().addFoodType({ name: "F", unit: "kg" });
      useOnboardingStore.getState().setIncubatorsData([{ name: "I", capacity: 50 }]);
      useOnboardingStore.getState().addInviteEmail("x@test.com");
      useOnboardingStore.getState().nextStep();

      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(0);
      expect(state.orgData).toBeNull();
      expect(state.farmData).toBeNull();
      expect(state.poolsData).toEqual([]);
      expect(state.incubatorsData).toEqual([]);
      expect(state.foodTypesData).toEqual([]);
      expect(state.cleaningProductsData).toEqual([]);
      expect(state.cleaningFrequencyDays).toBeNull();
      expect(state.inviteEmails).toEqual([]);
    });
  });
});
