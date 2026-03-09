import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { InviteWorkerStep } from "../InviteWorkerStep";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        onboarding: {
          invite: {
            email: "Guest email",
            skip: "Skip for now",
          },
          complete: {
            title: "Setup Complete!",
          },
          steps: { invite: "Invite Team" },
        },
        common: {
          actions: {
            back: "Back",
            add: "Add",
            remove: "Remove",
            complete: "Complete",
          },
        },
      },
    },
    defaultNS: "onboarding",
    ns: ["onboarding", "common"],
    interpolation: { escapeValue: false },
  });
});

function renderStep(onComplete = vi.fn(), onBack = vi.fn()) {
  return {
    onComplete,
    onBack,
    user: userEvent.setup(),
    ...render(<InviteWorkerStep onComplete={onComplete} onBack={onBack} />),
  };
}

describe("InviteWorkerStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders email input", () => {
    renderStep();

    expect(screen.getByLabelText("Guest email")).toBeInTheDocument();
  });

  it("allows adding email invitations", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Guest email"), "worker@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("worker@example.com")).toBeInTheDocument();
    });
  });

  it("allows adding multiple emails", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Guest email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("a@example.com")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Guest email"), "b@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("b@example.com")).toBeInTheDocument();
    });
  });

  it("shows list of added emails", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Guest email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  it("has Skip and Complete buttons", () => {
    renderStep();

    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
  });

  it("calls onComplete with emails list when Complete clicked", async () => {
    const { user, onComplete } = renderStep();

    await user.type(screen.getByLabelText("Guest email"), "w@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("w@example.com")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(["w@example.com"]);
    });
  });

  it("calls onComplete with empty list when Skip clicked", async () => {
    const { user, onComplete } = renderStep();

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith([]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});
