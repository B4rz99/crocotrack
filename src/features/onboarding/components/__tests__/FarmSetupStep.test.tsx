import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FarmSetupStep } from "../FarmSetupStep";

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

    expect(screen.getByLabelText("Nombre de la granja")).toBeInTheDocument();
    expect(screen.getByLabelText("Ubicación")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("calls onNext with valid data", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Nombre de la granja"), "My Farm");
    await user.type(screen.getByLabelText("Ubicación"), "Somewhere");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({
        name: "My Farm",
        location: "Somewhere",
      });
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(onBack).toHaveBeenCalled();
  });
});
