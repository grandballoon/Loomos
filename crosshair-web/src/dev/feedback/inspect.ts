/**
 * Describe a DOM element for a feedback note: a CSS path, its text and
 * opening tag, and the React source frames that rendered it.
 *
 * Source frames come from React 18's dev-only fiber fields: each fiber's
 * `_debugSource` is the file:line:column of the JSX that created it (added
 * by @vitejs/plugin-react in dev). That points Claude straight at the code.
 */

import type { ElementInfo, SourceFrame } from "../../../feedback/core";

/** Marks overlay elements so they are never picked themselves. */
export const OVERLAY_ATTR = "data-ui-feedback";

interface Fiber {
  type: unknown;
  return: Fiber | null;
  _debugSource?: { fileName: string; lineNumber: number; columnNumber?: number };
}

const MAX_FRAMES = 8;

export function isOverlayElement(el: Element): boolean {
  return el.closest(`[${OVERLAY_ATTR}]`) !== null;
}

function fiberOf(el: Element): Fiber | null {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
}

function componentName(type: unknown): string | null {
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  if (typeof type === "object" && type !== null) {
    // memo() and forwardRef() wrap the component.
    const wrapped = type as { displayName?: string; type?: unknown; render?: unknown };
    return wrapped.displayName ?? componentName(wrapped.type ?? wrapped.render);
  }
  return null;
}

function sourceOf(fiber: Fiber): string | undefined {
  const s = fiber._debugSource;
  if (!s) return undefined;
  return `${s.fileName}:${s.lineNumber}${s.columnNumber !== undefined ? `:${s.columnNumber}` : ""}`;
}

/** The clicked element's JSX, then each enclosing component's usage site. */
export function sourceFrames(el: Element): SourceFrame[] {
  // Text-less wrappers (e.g. SVG children) may lack a fiber; climb to one.
  let node: Element | null = el;
  let fiber: Fiber | null = null;
  while (node && !(fiber = fiberOf(node))) node = node.parentElement;
  if (!fiber || !node) return [];

  const frames: SourceFrame[] = [{ name: node.tagName.toLowerCase(), source: sourceOf(fiber) }];
  for (let f = fiber.return; f && frames.length < MAX_FRAMES; f = f.return) {
    const name = componentName(f.type);
    if (name) frames.push({ name, source: sourceOf(f) });
  }
  return frames.map((f) => (f.source === undefined ? { name: f.name } : f));
}

/** A readable CSS path from the nearest id (or body) down to the element. */
export function cssPath(el: Element): string {
  const parts: string[] = [];
  for (
    let node: Element | null = el;
    node && node !== document.body && node !== document.documentElement;
    node = node.parentElement
  ) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const classes = Array.from(node.classList).slice(0, 2);
    part += classes.map((c) => `.${CSS.escape(c)}`).join("");
    const parent: Element | null = node.parentElement;
    if (parent) {
      const tag = node.tagName;
      const siblings = Array.from(parent.children).filter((c) => c.tagName === tag);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
  }
  return parts.join(" > ");
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function describeElement(el: Element): ElementInfo {
  const rect = el.getBoundingClientRect();
  const outer = el.outerHTML;
  return {
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    text: truncate((el.textContent ?? "").replace(/\s+/g, " ").trim(), 160),
    html: truncate(outer.slice(0, outer.indexOf(">") + 1), 300),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
    frames: sourceFrames(el),
  };
}
