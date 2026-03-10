import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PoolSetupStep } from "../PoolSetupStep";

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

    expect(
      screen.getByText(
        "Genera tus estanques en lote. Define cuántos necesitas, el patrón de numeración y la capacidad por tipo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Grupo 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad")).toBeInTheDocument();
    expect(screen.getByLabelText("Capacidad por estanque")).toBeInTheDocument();
    expect(screen.getByLabelText("Prefijo")).toBeInTheDocument();
    expect(screen.getByLabelText("Número inicial")).toBeInTheDocument();
  });

  it("shows preview when quantity is entered", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Cantidad"), "5");
    await user.type(screen.getByLabelText("Capacidad por estanque"), "100");

    await waitFor(() => {
      expect(screen.getByText("Vista previa:")).toBeInTheDocument();
      expect(screen.getByText("1, 2, 3, 4, 5")).toBeInTheDocument();
    });
  });

  it("shows preview with prefix", async () => {
    const { user } = renderStep();

    await user.clear(screen.getByLabelText("Prefijo"));
    await user.type(screen.getByLabelText("Prefijo"), "A");
    await user.type(screen.getByLabelText("Cantidad"), "3");
    await user.type(screen.getByLabelText("Capacidad por estanque"), "50");

    await waitFor(() => {
      expect(screen.getByText("A1, A2, A3")).toBeInTheDocument();
    });
  });

  it("shows validation errors when submitting without required fields", async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("generates pools and calls onNext", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Cantidad"), "3");
    await user.type(screen.getByLabelText("Capacidad por estanque"), "100");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

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

    await user.click(screen.getByRole("button", { name: "+ Agregar otro grupo" }));

    await waitFor(() => {
      expect(screen.getByText("Grupo 2")).toBeInTheDocument();
    });
  });

  it("shows total pool count summary", async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText("Cantidad"), "10");
    await user.type(screen.getByLabelText("Capacidad por estanque"), "50");

    await waitFor(() => {
      expect(screen.getByText("Se crearán 10 estanques en total")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const { user, onBack } = renderStep();

    await user.click(screen.getByRole("button", { name: "Atrás" }));

    expect(onBack).toHaveBeenCalled();
  });
});
