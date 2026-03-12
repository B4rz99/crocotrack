import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolFormModal } from "../PoolFormModal";

describe("PoolFormModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Crear Estanque' title when no pool prop", () => {
    render(<PoolFormModal {...defaultProps} />);
    expect(screen.getByText("Crear Estanque")).toBeInTheDocument();
  });

  it("renders 'Editar Estanque' title when pool prop provided", () => {
    render(
      <PoolFormModal
        {...defaultProps}
        pool={{ name: "Estanque A", pool_type: "crianza", capacity: 100 }}
      />,
    );
    expect(screen.getByText("Editar Estanque")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<PoolFormModal {...defaultProps} />);

    const capacityInput = screen.getByLabelText("Capacidad");
    await user.type(capacityInput, "50");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with correct data", async () => {
    const user = userEvent.setup();
    render(<PoolFormModal {...defaultProps} />);

    const nameInput = screen.getByLabelText("Nombre del estanque");
    await user.type(nameInput, "Nuevo Estanque");

    const capacityInput = screen.getByLabelText("Capacidad");
    await user.type(capacityInput, "75");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nuevo Estanque",
          pool_type: "crianza",
          capacity: 75,
        }),
      );
    });
  });

  it("pre-fills fields in edit mode", () => {
    render(
      <PoolFormModal
        {...defaultProps}
        pool={{ name: "Estanque Existente", pool_type: "reproductor", capacity: 200 }}
      />,
    );

    const nameInput = screen.getByLabelText("Nombre del estanque");
    const capacityInput = screen.getByLabelText("Capacidad");

    expect(nameInput).toHaveValue("Estanque Existente");
    expect(capacityInput).toHaveValue(200);
  });

  it("shows 'Guardar' button text in edit mode", () => {
    render(
      <PoolFormModal
        {...defaultProps}
        pool={{ name: "Estanque A", pool_type: "crianza", capacity: 50 }}
      />,
    );
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancelar clicked", async () => {
    const user = userEvent.setup();
    render(<PoolFormModal {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
