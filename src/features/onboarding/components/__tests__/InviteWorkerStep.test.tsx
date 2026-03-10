import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteWorkerStep } from "../InviteWorkerStep";

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

    expect(screen.getByLabelText("Correo electrónico del invitado")).toBeInTheDocument();
  });

  it("allows adding email invitations", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Correo electrónico del invitado"), "worker@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(screen.getByText("worker@example.com")).toBeInTheDocument();
    });
  });

  it("allows adding multiple emails", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Correo electrónico del invitado"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(screen.getByText("a@example.com")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Correo electrónico del invitado"), "b@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(screen.getByText("b@example.com")).toBeInTheDocument();
    });
  });

  it("shows list of added emails", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Correo electrónico del invitado"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  it("has Skip and Complete buttons", () => {
    renderStep();

    expect(screen.getByRole("button", { name: "Omitir por ahora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completar" })).toBeInTheDocument();
  });

  it("calls onComplete with emails list when Complete clicked", async () => {
    const { user, onComplete } = renderStep();

    await user.type(screen.getByLabelText("Correo electrónico del invitado"), "w@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(screen.getByText("w@example.com")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Completar" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(["w@example.com"]);
    });
  });

  it("calls onComplete with empty list when Skip clicked", async () => {
    const { user, onComplete } = renderStep();

    await user.click(screen.getByRole("button", { name: "Omitir por ahora" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith([]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(onBack).toHaveBeenCalled();
  });
});
