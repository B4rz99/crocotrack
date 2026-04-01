import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FarmFormModal } from "../FarmFormModal";

describe("FarmFormModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Crear Granja' title when no farm prop", () => {
    render(<FarmFormModal {...defaultProps} />);
    expect(screen.getByText("Crear Granja")).toBeInTheDocument();
  });

  it("renders 'Editar Granja' title when farm prop provided", () => {
    render(<FarmFormModal {...defaultProps} farm={{ name: "Mi Granja", location: "Bogotá" }} />);
    expect(screen.getByText("Editar Granja")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<FarmFormModal {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with form data when valid", async () => {
    const user = userEvent.setup();
    render(<FarmFormModal {...defaultProps} />);

    const nameInput = screen.getByLabelText("Nombre de la granja");
    await user.type(nameInput, "Nueva Granja");

    const submitButton = screen.getByRole("button", { name: "Crear" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        name: "Nueva Granja",
      });
    });
  });

  it("pre-fills fields in edit mode", () => {
    render(
      <FarmFormModal {...defaultProps} farm={{ name: "Granja Existente", location: "Medellín" }} />,
    );

    const nameInput = screen.getByLabelText("Nombre de la granja");
    const locationInput = screen.getByLabelText("Ubicación");

    expect(nameInput).toHaveValue("Granja Existente");
    expect(locationInput).toHaveValue("Medellín");
  });

  it("shows 'Guardar' button text in edit mode", () => {
    render(<FarmFormModal {...defaultProps} farm={{ name: "Mi Granja" }} />);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancelar clicked", async () => {
    const user = userEvent.setup();
    render(<FarmFormModal {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
