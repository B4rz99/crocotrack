import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";

function renderDialog(overrides: Partial<Parameters<typeof DeleteConfirmDialog>[0]> = {}) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const onConfirm = overrides.onConfirm ?? vi.fn();

  return {
    onOpenChange,
    onConfirm,
    user: userEvent.setup(),
    ...render(
      <DeleteConfirmDialog
        open={overrides.open ?? true}
        onOpenChange={onOpenChange}
        title={overrides.title ?? "Eliminar granja"}
        description={overrides.description ?? "Esta accion no se puede deshacer."}
        onConfirm={onConfirm}
        isLoading={overrides.isLoading}
      />
    ),
  };
}

describe("DeleteConfirmDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and description when open", () => {
    renderDialog({
      title: "Eliminar granja",
      description: "Se eliminara permanentemente.",
    });

    expect(screen.getByText("Eliminar granja")).toBeInTheDocument();
    expect(screen.getByText("Se eliminara permanentemente.")).toBeInTheDocument();
  });

  it("calls onConfirm when Eliminar button clicked", async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when Cancelar button clicked", async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
