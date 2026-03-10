import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IncubatorSetupStep } from "../IncubatorSetupStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          incubator: {
            capacity: "Capacity",
            enable: "Enable incubator setup",
            quantity: "Number of incubators",
            capacity_per: "Capacity per incubator",
            summary: "{{count}} incubators will be created",
            error_quantity: "Enter the number of incubators",
            error_capacity: "Enter the capacity per incubator",
          },
          steps: { incubators: "Incubators" },
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
    ...render(<IncubatorSetupStep onNext={onNext} onBack={onBack} />),
  };
}

describe("IncubatorSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders enable toggle", () => {
    renderStep();

    expect(screen.getByLabelText("Enable incubator setup")).toBeInTheDocument();
  });

  it("shows quantity and capacity fields when enabled", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));

    await waitFor(() => {
      expect(screen.getByLabelText("Number of incubators")).toBeInTheDocument();
      expect(screen.getByLabelText("Capacity per incubator")).toBeInTheDocument();
    });
  });

  it("shows summary when quantity and capacity are filled", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));
    await user.type(screen.getByLabelText("Number of incubators"), "3");
    await user.type(screen.getByLabelText("Capacity per incubator"), "500");

    await waitFor(() => {
      expect(screen.getByText("3 incubators will be created")).toBeInTheDocument();
    });
  });

  it("shows validation errors when enabled but fields empty", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("calls onNext with empty list when disabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([]);
    });
  });

  it("calls onNext with generated incubators when enabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));
    await user.type(screen.getByLabelText("Number of incubators"), "2");
    await user.type(screen.getByLabelText("Capacity per incubator"), "500");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([
        { name: "1", capacity: 500 },
        { name: "2", capacity: 500 },
      ]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
