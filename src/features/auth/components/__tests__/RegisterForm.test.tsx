import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "../RegisterForm";

function renderRegisterForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <RegisterForm onSubmit={onSubmit} />
      </MemoryRouter>
    ),
  };
}

describe("RegisterForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders full_name, email, password, and org_name fields", () => {
    renderRegisterForm();

    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la organización")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrarse" })).toBeInTheDocument();
  });

  it("shows validation errors for all required fields on empty submit", async () => {
    const { user } = renderRegisterForm();

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(4);
    });
  });

  it("shows validation error for invalid email", async () => {
    const { user } = renderRegisterForm();

    await user.type(screen.getByLabelText("Nombre completo"), "Test User");
    await user.type(screen.getByLabelText("Correo electrónico"), "not-an-email");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.type(screen.getByLabelText("Nombre de la organización"), "My Org");
    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for short password", async () => {
    const { user } = renderRegisterForm();

    await user.type(screen.getByLabelText("Nombre completo"), "Test User");
    await user.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "12345");
    await user.type(screen.getByLabelText("Nombre de la organización"), "My Org");
    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls onSubmit with form data when valid", async () => {
    const { user, onSubmit } = renderRegisterForm();

    await user.type(screen.getByLabelText("Nombre completo"), "Test User");
    await user.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.type(screen.getByLabelText("Nombre de la organización"), "My Org");
    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        full_name: "Test User",
        email: "test@example.com",
        password: "password123",
        org_name: "My Org",
      });
    });
  });

  it("does not call onSubmit when validation fails", async () => {
    const { user, onSubmit } = renderRegisterForm();

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has a link to the login page", () => {
    renderRegisterForm();

    const link = screen.getByRole("link", { name: "Inicia sesión aquí" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });

  it("disables submit button when isLoading is true", () => {
    render(
      <MemoryRouter>
        <RegisterForm onSubmit={vi.fn()} isLoading />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Registrarse" })).toBeDisabled();
  });
});
