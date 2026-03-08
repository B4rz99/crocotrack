import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";
import { APP_CONFIG } from "../constants/config";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: APP_CONFIG.DEFAULT_LANGUAGE,
    supportedLngs: APP_CONFIG.SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: ["common", "auth", "onboarding"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
