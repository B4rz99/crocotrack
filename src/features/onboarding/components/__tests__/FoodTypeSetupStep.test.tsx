import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FoodTypeSetupStep } from "../FoodTypeSetupStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          food_type: {
            name: "Food name",
            unit: "Unit of measurement",
            defaults: {
              pollo: "Chicken",
              pescado: "Fish",
              visceras: "Offal",
            },
          },
          steps: { food_types: "Food Types" },
        },
        common: {
          actions: {
            next: "Next",
            back: "Back",
            add: "Add",
            remove: "Remove",
          },
        },
      },
    },
    defaultNS: "onboarding",
    ns: ["onboarding", "common"],
    interpolation: { escapeValue: false },
  });
});

function renderStep(onNext = vi.fn(), onBack = vi.fn()) {
  return {
    onNext,
    onBack,
    user: userEvent.setup(),
    ...render(<FoodTypeSetupStep onNext={onNext} onBack={onBack} />),
  };
}

describe("FoodTypeSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows default food types pre-added", () => {
    renderStep();

    expect(screen.getByText("Pollo")).toBeInTheDocument();
    expect(screen.getByText("Pescado")).toBeInTheDocument();
    expect(screen.getByText("Vísceras")).toBeInTheDocument();
  });

  it("allows adding custom food types", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Food name"), "Cerdo");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Cerdo")).toBeInTheDocument();
    });
  });

  it("allows removing food types", async () => {
    const { user } = renderStep();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    const firstButton = removeButtons[0];
    if (!firstButton) throw new Error("No remove button found");
    await user.click(firstButton);

    await waitFor(() => {
      expect(screen.queryByText("Pollo")).not.toBeInTheDocument();
    });
  });

  it("calls onNext with food types list", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([
        { name: "Pollo", unit: "kg" },
        { name: "Pescado", unit: "kg" },
        { name: "Vísceras", unit: "kg" },
      ]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
