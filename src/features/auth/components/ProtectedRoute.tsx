import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { ROUTES } from "@/shared/constants/routes";

interface ProtectedRouteProps {
  readonly requiredRole?: "owner" | "worker";
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);

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

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
