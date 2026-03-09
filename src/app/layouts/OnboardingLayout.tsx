import { Outlet } from "react-router";

export function OnboardingLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">CrocoTrack</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up your farm</p>
      </div>
      <div className="mb-6 w-full max-w-lg">
        {/* Progress indicator area — filled in by onboarding steps */}
      </div>
      <div className="w-full max-w-lg">
        <Outlet />
      </div>
    </div>
  );
}
