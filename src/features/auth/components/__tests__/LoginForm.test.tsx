import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../LoginForm";

function renderLoginForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <LoginForm onSubmit={onSubmit} />
      </MemoryRouter>
    ),
  };
}

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders email and password fields", () => {
    renderLoginForm();

    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const { user } = renderLoginForm();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows validation error for invalid email", async () => {
    const { user } = renderLoginForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "not-an-email");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for short password", async () => {
    const { user } = renderLoginForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "12345");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls onSubmit with form data when valid", async () => {
    const { user, onSubmit } = renderLoginForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("does not call onSubmit when validation fails", async () => {
    const { user, onSubmit } = renderLoginForm();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has a link to the register page", () => {
    renderLoginForm();

    const link = screen.getByRole("link", { name: "Regístrate aquí" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });

  it("disables submit button when isLoading is true", () => {
    render(
      <MemoryRouter>
        <LoginForm onSubmit={vi.fn()} isLoading />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
  });
});
