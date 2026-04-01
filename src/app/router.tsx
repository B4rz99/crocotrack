import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { CreateEntradaPage } from "@/features/entradas/pages/CreateEntradaPage";
import { EntradasListPage } from "@/features/entradas/pages/EntradasListPage";
import { FarmDetailPage } from "@/features/farms/pages/FarmDetailPage";
import { FarmsPage } from "@/features/farms/pages/FarmsPage";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { ROUTES } from "@/shared/constants/routes";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { OnboardingLayout } from "./layouts/OnboardingLayout";

/* ---------- Placeholder pages ---------- */
const InvitePage = () => <div>Invite</div>;
const DashboardPage = () => <div>Dashboard</div>;
const SettingsPage = () => <div>Settings</div>;
const SettingsTeamPage = () => <div>Settings Team</div>;

/* ---------- Router ---------- */

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.REGISTER, element: <RegisterPage /> },
      { path: ROUTES.INVITE, element: <InvitePage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: ROUTES.ONBOARDING,
        element: <OnboardingLayout />,
        children: [{ index: true, element: <OnboardingPage /> }],
      },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: ROUTES.FARMS, element: <FarmsPage /> },
          { path: ROUTES.FARM_DETAIL, element: <FarmDetailPage /> },
          { path: ROUTES.ENTRADAS, element: <EntradasListPage /> },
          { path: ROUTES.ENTRADA_CREATE, element: <CreateEntradaPage /> },
          { path: ROUTES.SETTINGS, element: <SettingsPage /> },
          { path: ROUTES.SETTINGS_TEAM, element: <SettingsTeamPage /> },
        ],
      },
    ],
  },
]);
