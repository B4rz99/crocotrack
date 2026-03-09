import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "../RegisterForm";

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: "en",
      resources: {
        en: {
          auth: {
            register: {
              title: "Create Account",
              full_name: "Full name",
              email: "Email",
              password: "Password",
              org_name: "Organization name",
              submit: "Register",
              has_account: "Already have an account?",
              login_link: "Sign in here",
            },
          },
        },
      },
      defaultNS: "auth",
      interpolation: { escapeValue: false },
    });
  }
});

function renderRegisterForm(onSubmit = vi.fn()) {
  return {
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <RegisterForm onSubmit={onSubmit} />
      </MemoryRouter>,
    ),
  };
}

describe("RegisterForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders full_name, email, password, and org_name fields", () => {
    renderRegisterForm();

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });

  it("shows validation errors for all required fields on empty submit", async () => {
    const { user } = renderRegisterForm();

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(4);
    });
  });

  it("shows validation error for invalid email", async () => {
    const { user } = renderRegisterForm();

    await user.type(screen.getByLabelText("Full name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Organization name"), "My Org");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for short password", async () => {
    const { user } = renderRegisterForm();

    await user.type(screen.getByLabelText("Full name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "12345");
    await user.type(screen.getByLabelText("Organization name"), "My Org");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls onSubmit with form data when valid", async () => {
    const { user, onSubmit } = renderRegisterForm();

    await user.type(screen.getByLabelText("Full name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Organization name"), "My Org");
    await user.click(screen.getByRole("button", { name: "Register" }));

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

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has a link to the login page", () => {
    renderRegisterForm();

    const link = screen.getByRole("link", { name: "Sign in here" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });

  it("disables submit button when isLoading is true", () => {
    render(
      <MemoryRouter>
        <RegisterForm onSubmit={vi.fn()} isLoading />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Register" })).toBeDisabled();
  });
});
