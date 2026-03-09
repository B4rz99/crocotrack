import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FarmSetupStep } from "../FarmSetupStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          farm: {
            name: "Farm name",
            location: "Location",
          },
          steps: { farm: "Farm" },
        },
        common: {
          actions: {
            next: "Next",
            back: "Back",
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
    ...render(<FarmSetupStep onNext={onNext} onBack={onBack} />),
  };
}

describe("FarmSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders name and location fields", () => {
    renderStep();

    expect(screen.getByLabelText("Farm name")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("calls onNext with valid data", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Farm name"), "My Farm");
    await user.type(screen.getByLabelText("Location"), "Somewhere");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({
        name: "My Farm",
        location: "Somewhere",
      });
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
