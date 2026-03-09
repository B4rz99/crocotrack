import { Outlet } from "react-router";

export function AuthLayout() {
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
