import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/azeret-mono/400.css";
import "@fontsource/azeret-mono/500.css";
import "./index.css";

import { isFeedbackRoute } from "../feedback/core";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev-only UI feedback overlay at /ui-feedback (Alt-click to leave notes for
// Claude). The DEV guard lets the production build drop it entirely.
if (import.meta.env.DEV && isFeedbackRoute(location.pathname)) {
  void import("./dev/feedback/mount").then(({ mount }) => mount());
}
