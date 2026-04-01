import { Navigate, Outlet } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { ROUTES } from "@/shared/constants/routes";

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore(
    useShallow((s) => ({ isAuthenticated: s.isAuthenticated, isLoading: s.isLoading }))
  );

  if (!isLoading && isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">CrocoTrack</h1>
        <p className="mt-1 text-sm text-muted-foreground">Crocodile Farm Management</p>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
