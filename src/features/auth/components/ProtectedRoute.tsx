import { Navigate, Outlet, useLocation } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { ROUTES } from "@/shared/constants/routes";

interface ProtectedRouteProps {
  readonly requiredRole?: "owner" | "worker";
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile, onboardingCompleted } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
      profile: s.profile,
      onboardingCompleted: s.onboardingCompleted,
    }))
  );
  const location = useLocation();

  if (isLoading) {
    return (
      <output aria-label="Loading">
        <span>Loading...</span>
      </output>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!onboardingCompleted && location.pathname !== ROUTES.ONBOARDING) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  if (onboardingCompleted && location.pathname === ROUTES.ONBOARDING) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
