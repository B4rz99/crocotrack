export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARMS: "/farms",                              // kept — still used by AppLayout & router until later tasks
  FARM_DETAIL: "/farms/:farmId",               // kept — still used by FarmDetailPage until cleanup task
  FARM_DASHBOARD: "/farms/:farmId",            // new semantic alias used going forward
  ENTRADAS: "/farms/:farmId/entradas",
  ENTRADA_CREATE: "/farms/:farmId/entradas/nueva",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
  SETTINGS_FARMS: "/settings/farms",           // new
} as const;
