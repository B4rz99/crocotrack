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
            name: "Incubator name",
            capacity: "Capacity",
            enable: "Enable incubator setup",
          },
          steps: { incubators: "Incubators" },
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

  it("shows form fields when enabled", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));

    await waitFor(() => {
      expect(screen.getByLabelText("Incubator name")).toBeInTheDocument();
      expect(screen.getByLabelText("Capacity")).toBeInTheDocument();
    });
  });

  it("allows adding an incubator", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));

    await waitFor(() => {
      expect(screen.getByLabelText("Incubator name")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Incubator name"), "Inc 1");
    await user.type(screen.getByLabelText("Capacity"), "200");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Inc 1")).toBeInTheDocument();
    });
  });

  it("allows removing an incubator", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));

    await waitFor(() => {
      expect(screen.getByLabelText("Incubator name")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Incubator name"), "Inc 1");
    await user.type(screen.getByLabelText("Capacity"), "200");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Inc 1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(screen.queryByText("Inc 1")).not.toBeInTheDocument();
    });
  });

  it("calls onNext with empty list when disabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([]);
    });
  });

  it("calls onNext with incubator list when enabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByLabelText("Enable incubator setup"));

    await waitFor(() => {
      expect(screen.getByLabelText("Incubator name")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Incubator name"), "Inc 1");
    await user.type(screen.getByLabelText("Capacity"), "200");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Inc 1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([{ name: "Inc 1", capacity: 200 }]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
