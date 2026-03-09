import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PoolSetupStep } from "../PoolSetupStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          pool: {
            name: "Pool name",
            type: "Pool type",
            capacity: "Capacity",
            type_crianza: "Rearing",
            type_reproductor: "Breeder",
          },
          steps: { pools: "Pools" },
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
    ...render(<PoolSetupStep onNext={onNext} onBack={onBack} />),
  };
}

describe("PoolSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders pool form fields", () => {
    renderStep();

    expect(screen.getByLabelText("Pool name")).toBeInTheDocument();
    expect(screen.getByLabelText("Capacity")).toBeInTheDocument();
  });

  it("allows adding a pool", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Pool name"), "Pool A");
    await user.type(screen.getByLabelText("Capacity"), "50");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Pool A")).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid pool", async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("allows removing a pool", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Pool name"), "Pool A");
    await user.type(screen.getByLabelText("Capacity"), "50");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Pool A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(screen.queryByText("Pool A")).not.toBeInTheDocument();
    });
  });

  it("calls onNext with pools list", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Pool name"), "Pool A");
    await user.type(screen.getByLabelText("Capacity"), "50");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Pool A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([{ name: "Pool A", pool_type: "crianza", capacity: 50 }]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
