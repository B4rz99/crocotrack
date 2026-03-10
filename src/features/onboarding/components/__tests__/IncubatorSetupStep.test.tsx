import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncubatorSetupStep } from "../IncubatorSetupStep";

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

    expect(screen.getByLabelText("Habilitar configuración de incubadoras")).toBeInTheDocument();
  });

  it("shows quantity and capacity fields when enabled", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Habilitar configuración de incubadoras"));

    await waitFor(() => {
      expect(screen.getByLabelText("Cantidad de incubadoras")).toBeInTheDocument();
      expect(screen.getByLabelText("Capacidad por incubadora")).toBeInTheDocument();
    });
  });

  it("shows summary when quantity and capacity are filled", async () => {
    const { user } = renderStep();

    await user.click(screen.getByLabelText("Habilitar configuración de incubadoras"));
    await user.type(screen.getByLabelText("Cantidad de incubadoras"), "3");
    await user.type(screen.getByLabelText("Capacidad por incubadora"), "500");

    await waitFor(() => {
      expect(screen.getByText("Se crearán 3 incubadoras")).toBeInTheDocument();
    });
  });

  it("shows validation errors when enabled but fields empty", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByLabelText("Habilitar configuración de incubadoras"));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("calls onNext with empty list when disabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([]);
    });
  });

  it("calls onNext with generated incubators when enabled", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByLabelText("Habilitar configuración de incubadoras"));
    await user.type(screen.getByLabelText("Cantidad de incubadoras"), "2");
    await user.type(screen.getByLabelText("Capacidad por incubadora"), "500");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith([
        { name: "1", capacity: 500 },
        { name: "2", capacity: 500 },
      ]);
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(onBack).toHaveBeenCalled();
  });
});
