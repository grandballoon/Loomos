/** Mount the feedback overlay in its own React root, outside the app's tree. */

import { createRoot } from "react-dom/client";

import { FeedbackOverlay } from "./FeedbackOverlay";
import { OVERLAY_ATTR } from "./inspect";

export function mount(): void {
  const host = document.createElement("div");
  host.setAttribute(OVERLAY_ATTR, "");
  document.body.appendChild(host);
  createRoot(host).render(<FeedbackOverlay />);
}
