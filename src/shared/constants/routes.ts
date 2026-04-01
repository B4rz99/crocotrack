export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARMS: "/farms",
  FARM_DETAIL: "/farms/:farmId",
  ENTRADAS: "/farms/:farmId/entradas",
  ENTRADA_CREATE: "/farms/:farmId/entradas/nueva",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
} as const;
