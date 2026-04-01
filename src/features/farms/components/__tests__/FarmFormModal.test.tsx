import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FarmFormModal } from "../FarmFormModal";

function renderModal(overrides: Partial<Parameters<typeof FarmFormModal>[0]> = {}) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const onSubmit = overrides.onSubmit ?? vi.fn();

  return {
    onOpenChange,
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <FarmFormModal
        open={overrides.open ?? true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isLoading={overrides.isLoading}
        farm={overrides.farm}
      />
    ),
  };
}

describe("FarmFormModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 'Crear Granja' title when no farm prop", () => {
    renderModal();

    expect(screen.getByText("Crear Granja")).toBeInTheDocument();
  });

  it("renders 'Editar Granja' title when farm prop provided", () => {
    renderModal({ farm: { name: "Granja Norte", location: "Monteria" } });

    expect(screen.getByText("Editar Granja")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const { user, onSubmit } = renderModal();

    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with form data when valid", async () => {
    const { user, onSubmit } = renderModal();

    await user.type(screen.getByLabelText("Nombre de la granja"), "Granja Sur");
    await user.type(screen.getByLabelText("Ubicación"), "Sincelejo");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Granja Sur",
        location: "Sincelejo",
      });
    });
  });

  it("pre-fills fields in edit mode", () => {
    renderModal({ farm: { name: "Granja Norte", location: "Monteria" } });

    expect(screen.getByLabelText("Nombre de la granja")).toHaveValue("Granja Norte");
    expect(screen.getByLabelText("Ubicación")).toHaveValue("Monteria");
  });
});
