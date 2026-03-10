import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrgSetupStep } from "../OrgSetupStep";

function renderStep(onNext = vi.fn()) {
  return {
    onNext,
    user: userEvent.setup(),
    ...render(<OrgSetupStep onNext={onNext} />),
  };
}

describe("OrgSetupStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders name field and country/currency select labels", () => {
    renderStep();

    expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument();
    expect(screen.getByText("País")).toBeInTheDocument();
    expect(screen.getByText("Moneda")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const { user, onNext } = renderStep();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("calls onNext with valid data using default country/currency", async () => {
    const { user, onNext } = renderStep();

    await user.type(screen.getByLabelText("Nombre de la organización"), "My Org");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith({
        name: "My Org",
        country: "CO",
        currency: "COP",
      });
    });
  });
});
