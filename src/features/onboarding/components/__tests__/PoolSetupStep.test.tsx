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
            batch_description: "Generate your pools in bulk.",
            group_label: "Group {{n}}",
            quantity: "Quantity",
            prefix: "Prefix",
            prefix_placeholder: "e.g. A, R, P",
            start_number: "Start number",
            capacity_per_pool: "Capacity per pool",
            preview: "Preview:",
            and_more: "and {{count}} more",
            total_summary: "{{count}} pools will be created in total",
            add_group: "+ Add another group",
            error_quantity: "Enter the number of pools",
            error_capacity: "Enter the capacity per pool",
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

  it("renders batch pool form fields", () => {
    renderStep();

    expect(screen.getByText("Generate your pools in bulk.")).toBeInTheDocument();
    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Capacity per pool")).toBeInTheDocument();
    expect(screen.getByLabelText("Prefix")).toBeInTheDocument();
    expect(screen.getByLabelText("Start number")).toBeInTheDocument();
  });

  it("shows preview when quantity is entered", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Quantity"), "5");
    await user.type(screen.getByLabelText("Capacity per pool"), "100");

    await waitFor(() => {
      expect(screen.getByText("Preview:")).toBeInTheDocument();
      expect(screen.getByText("1, 2, 3, 4, 5")).toBeInTheDocument();
    });
  });

  it("shows preview with prefix", async () => {
    const { user } = renderStep();

    await user.clear(screen.getByLabelText("Prefix"));
    await user.type(screen.getByLabelText("Prefix"), "A");
    await user.type(screen.getByLabelText("Quantity"), "3");
    await user.type(screen.getByLabelText("Capacity per pool"), "50");

    await waitFor(() => {
      expect(screen.getByText("A1, A2, A3")).toBeInTheDocument();
    });
  });

  it("shows validation errors when submitting without required fields", async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("generates pools and calls onNext", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Quantity"), "3");
    await user.type(screen.getByLabelText("Capacity per pool"), "100");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([
        { name: "1", pool_type: "crianza", capacity: 100 },
        { name: "2", pool_type: "crianza", capacity: 100 },
        { name: "3", pool_type: "crianza", capacity: 100 },
      ]);
    });
  });

  it("allows adding another group", async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole("button", { name: "+ Add another group" }));

    await waitFor(() => {
      expect(screen.getByText("Group 2")).toBeInTheDocument();
    });
  });

  it("shows total pool count summary", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Quantity"), "10");
    await user.type(screen.getByLabelText("Capacity per pool"), "50");

    await waitFor(() => {
      expect(screen.getByText("10 pools will be created in total")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
