export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  INVITE: "/invite/:token",
  ONBOARDING: "/onboarding",
  DASHBOARD: "/",
  FARMS: "/farms",
  FARM_DETAIL: "/farms/:farmId",
  SETTINGS: "/settings",
  SETTINGS_TEAM: "/settings/team",
} as const;
