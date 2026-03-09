import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@/shared/lib/i18n";
import App from "./App";
import { Providers } from "./app/providers";

// biome-ignore lint/style/noNonNullAssertion: root element always exists
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
