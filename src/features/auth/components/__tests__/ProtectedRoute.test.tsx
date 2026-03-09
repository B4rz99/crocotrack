import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Profile } from "@/features/auth/stores/auth.store";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { ProtectedRoute } from "../ProtectedRoute";

const createMockProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: "user-123",
  email: "test@example.com",
  full_name: "Test User",
  avatar_url: null,
  phone: null,
  role: "owner",
  org_id: "org-123",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

function renderWithRouter(
  ui: React.ReactElement,
  { initialEntries = ["/protected"] }: { initialEntries?: string[] } = {},
) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it("renders a loading state when auth is loading", () => {
    // isLoading defaults to true in the store
    useAuthStore.setState({ isLoading: true, isAuthenticated: false });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index path="protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: false });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index path="protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path={ROUTES.LOGIN} element={<div>Login Page</div>} />
      </Routes>,
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      profile: createMockProfile(),
    });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index path="protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to dashboard when role does not match requiredRole", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      profile: createMockProfile({ role: "worker" }),
    });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute requiredRole="owner" />}>
          <Route index path="protected" element={<div>Owner Content</div>} />
        </Route>
        <Route path={ROUTES.DASHBOARD} element={<div>Dashboard</div>} />
      </Routes>,
    );

    expect(screen.queryByText("Owner Content")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("allows access when role matches requiredRole", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      profile: createMockProfile({ role: "owner" }),
    });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute requiredRole="owner" />}>
          <Route index path="protected" element={<div>Owner Content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByText("Owner Content")).toBeInTheDocument();
  });

  it("renders children when requiredRole is not set regardless of role", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      profile: createMockProfile({ role: "worker" }),
    });

    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route index path="protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
