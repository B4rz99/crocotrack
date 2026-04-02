export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARM_DASHBOARD: "/farms/:farmId",
  ENTRADAS: "/farms/:farmId/entradas",
  ENTRADA_CREATE: "/farms/:farmId/entradas/nueva",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
  SETTINGS_FARMS: "/settings/farms",
} as const;
