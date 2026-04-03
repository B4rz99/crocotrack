import { createBrowserRouter, Navigate } from "react-router";
import { AlimentacionListPage } from "@/features/alimentacion/pages/AlimentacionListPage";
import { CreateAlimentacionPage } from "@/features/alimentacion/pages/CreateAlimentacionPage";
import { CreateFoodPurchasePage } from "@/features/alimentacion/pages/CreateFoodPurchasePage";
import { FoodStockPage } from "@/features/alimentacion/pages/FoodStockPage";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { ClasificacionListPage } from "@/features/clasificacion/pages/ClasificacionListPage";
import { CreateClasificacionPage } from "@/features/clasificacion/pages/CreateClasificacionPage";
import { CreateEntradaPage } from "@/features/entradas/pages/CreateEntradaPage";
import { EntradasListPage } from "@/features/entradas/pages/EntradasListPage";
import { FarmDashboardPage } from "@/features/farms/pages/FarmDashboardPage";
import { FarmsPage } from "@/features/farms/pages/FarmsPage";
import { CreateMortalidadPage } from "@/features/mortalidad/pages/CreateMortalidadPage";
import { MortalidadListPage } from "@/features/mortalidad/pages/MortalidadListPage";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { ROUTES } from "@/shared/constants/routes";
import { RedirectToLastFarm } from "./components/RedirectToLastFarm";
import { AuthLayout } from "./layouts/AuthLayout";
import { FarmLayout } from "./layouts/FarmLayout";
import { OnboardingLayout } from "./layouts/OnboardingLayout";
import { SettingsLayout } from "./layouts/SettingsLayout";

/* ---------- Placeholder pages ---------- */
const InvitePage = () => <div>Invite</div>;
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
      // Root: redirect to last farm
      { path: ROUTES.DASHBOARD, element: <RedirectToLastFarm /> },
      // Backward-compat: old /farms list now lives at /settings/farms
      { path: "/farms", element: <Navigate to={ROUTES.SETTINGS_FARMS} replace /> },
      // Farm-scoped routes
      {
        path: ROUTES.FARM_DASHBOARD,
        element: <FarmLayout />,
        children: [
          { index: true, element: <FarmDashboardPage /> },
          { path: "entradas", element: <EntradasListPage /> },
          { path: "entradas/nueva", element: <CreateEntradaPage /> },
          { path: "mortalidad", element: <MortalidadListPage /> },
          { path: "mortalidad/nueva", element: <CreateMortalidadPage /> },
          { path: "alimentacion", element: <AlimentacionListPage /> },
          { path: "alimentacion/nueva", element: <CreateAlimentacionPage /> },
          { path: "alimentacion/stock", element: <FoodStockPage /> },
          { path: "alimentacion/stock/nueva", element: <CreateFoodPurchasePage /> },
          { path: "clasificacion", element: <ClasificacionListPage /> },
          { path: "clasificacion/nueva", element: <CreateClasificacionPage /> },
        ],
      },
      // Settings routes
      {
        path: ROUTES.SETTINGS,
        element: <SettingsLayout />,
        children: [
          { index: true, element: <SettingsPage /> },
          { path: "team", element: <SettingsTeamPage /> },
          { path: "farms", element: <FarmsPage /> },
        ],
      },
    ],
  },
]);
