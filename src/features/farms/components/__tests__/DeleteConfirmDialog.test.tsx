import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";

describe("DeleteConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Eliminar Granja",
    description: '¿Estás seguro de eliminar "Mi Granja"?',
    onConfirm: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and description", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Eliminar Granja")).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro de eliminar "Mi Granja"?')).toBeInTheDocument();
  });

  it("calls onConfirm when Eliminar clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmDialog {...defaultProps} />);

    const deleteButton = screen.getByRole("button", { name: "Eliminar" });
    await user.click(deleteButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange(false) when Cancelar clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmDialog {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables buttons when isLoading is true", () => {
    render(<DeleteConfirmDialog {...defaultProps} isLoading={true} />);

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });
});
