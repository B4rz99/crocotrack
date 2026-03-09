import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../LoginForm";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        auth: {
          login: {
            title: "Sign In",
            email: "Email",
            password: "Password",
            submit: "Sign In",
            no_account: "Don't have an account?",
            register_link: "Register here",
          },
        },
      },
    },
    defaultNS: "auth",
    interpolation: { escapeValue: false },
  });
});

function renderLoginForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <LoginForm onSubmit={onSubmit} />
      </MemoryRouter>,
    ),
  };
}

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders email and password fields", () => {
    renderLoginForm();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const { user } = renderLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows validation error for invalid email", async () => {
    const { user } = renderLoginForm();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for short password", async () => {
    const { user } = renderLoginForm();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "12345");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls onSubmit with form data when valid", async () => {
    const { user, onSubmit } = renderLoginForm();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("does not call onSubmit when validation fails", async () => {
    const { user, onSubmit } = renderLoginForm();

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has a link to the register page", () => {
    renderLoginForm();

    const link = screen.getByRole("link", { name: "Register here" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });

  it("disables submit button when isLoading is true", () => {
    render(
      <MemoryRouter>
        <LoginForm onSubmit={vi.fn()} isLoading />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Sign In" })).toBeDisabled();
  });
});
