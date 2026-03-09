import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OrgSetupStep } from "../OrgSetupStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          org: {
            name: "Organization name",
            country: "Country",
            currency: "Currency",
          },
          steps: { org: "Organization" },
        },
        common: {
          actions: {
            next: "Next",
          },
        },
      },
    },
    defaultNS: "onboarding",
    ns: ["onboarding", "common"],
    interpolation: { escapeValue: false },
  });
});

function renderStep(onNext = vi.fn()) {
  return {
    onNext,
    user: userEvent.setup(),
    ...render(<OrgSetupStep onNext={onNext} />),
  };
}

describe("OrgSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders name, country, and currency fields", () => {
    renderStep();

    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Currency")).toBeInTheDocument();
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

    await user.type(screen.getByLabelText("Organization name"), "My Org");
    await user.clear(screen.getByLabelText("Country"));
    await user.type(screen.getByLabelText("Country"), "CO");
    await user.clear(screen.getByLabelText("Currency"));
    await user.type(screen.getByLabelText("Currency"), "COP");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({
        name: "My Org",
        country: "CO",
        currency: "COP",
      });
    });
  });
});
