/**
 * Formatting effects drawn over an image rectangle or its blank mirror.
 *
 * Each effect is a pure function from (settings, rect) to primitive shapes in
 * page points, y-up like PDF. Both the SVG preview and the pdf-lib renderer
 * consume the same shapes, so what you see is exactly what prints. Effects
 * know nothing about leaves, spreads, or binding — that is what lets one
 * effect format an image page and its blank companion identically.
 *
 * Ported from crosshair_print/overlays.py.
 */

import { POINTS_PER_INCH } from "./lengths";

export type EffectKind = "none" | "crosshair" | "corner-x" | "grid" | "dot-grid";

export const EFFECT_KINDS: readonly EffectKind[] = [
  "none",
  "crosshair",
  "corner-x",
  "grid",
  "dot-grid",
];

export const EFFECT_LABELS: Record<EffectKind, string> = {
  none: "None",
  crosshair: "Crosshair",
  "corner-x": "Corner X",
  grid: "Grid",
  "dot-grid": "Dot grid",
};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Shape =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number };

/** Shared knobs for every effect; per-effect fields are ignored elsewhere. */
export interface EffectSettings {
  thickness: number; // stroke width, points
  color: Rgb;
  border: boolean; // outline the content rect, marking the blank's extent
  crosshairGap: number; // half-gap left empty at the center, points
  gridSpacing: number; // grid cell size, points
  dotPitch: number; // dot lattice pitch, points
  dotDiameter: number; // points
}

export const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  thickness: 0.75,
  color: { r: 1, g: 0, b: 0 },
  border: true,
  crosshairGap: 0,
  gridSpacing: 0.5 * POINTS_PER_INCH,
  dotPitch: 0.25 * POINTS_PER_INCH,
  dotDiameter: 0.75,
};

// Offsets this close to a rect edge are treated as coincident with it.
const EDGE_EPSILON = 0.05;

/**
 * Symmetric offsets from a center at `step` intervals within ±halfExtent.
 * `inclusive` keeps offsets landing on the boundary (dot lattices want the
 * edges; line grids drop them because the edge belongs to the border rect).
 */
export function centeredOffsets(halfExtent: number, step: number, inclusive: boolean): number[] {
  const limit = inclusive ? halfExtent + EDGE_EPSILON : halfExtent - EDGE_EPSILON;
  const offsets = [0];
  for (let k = 1; k * step <= limit; k++) {
    offsets.push(k * step, -k * step);
  }
  return offsets.sort((a, b) => a - b);
}

function crosshair(s: EffectSettings, rect: Rect): Shape[] {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hArm = rect.w / 2;
  const vArm = rect.h / 2;
  const gap = s.crosshairGap;
  if (gap > 0) {
    return [
      { kind: "line", x1: cx - hArm, y1: cy, x2: cx - gap, y2: cy },
      { kind: "line", x1: cx + gap, y1: cy, x2: cx + hArm, y2: cy },
      { kind: "line", x1: cx, y1: cy - vArm, x2: cx, y2: cy - gap },
      { kind: "line", x1: cx, y1: cy + gap, x2: cx, y2: cy + vArm },
    ];
  }
  return [
    { kind: "line", x1: cx - hArm, y1: cy, x2: cx + hArm, y2: cy },
    { kind: "line", x1: cx, y1: cy - vArm, x2: cx, y2: cy + vArm },
  ];
}

function cornerX(s: EffectSettings, rect: Rect): Shape[] {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gap = s.crosshairGap;
  if (gap <= 0) {
    return [
      { kind: "line", x1: x, y1: y, x2: x + w, y2: y + h },
      { kind: "line", x1: x, y1: y + h, x2: x + w, y2: y },
    ];
  }
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  const shapes: Shape[] = [];
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const length = Math.hypot(dx, dy);
    if (length <= gap) continue;
    shapes.push({
      kind: "line",
      x1: cx + (dx / length) * gap,
      y1: cy + (dy / length) * gap,
      x2: px,
      y2: py,
    });
  }
  return shapes;
}

function grid(s: EffectSettings, rect: Rect): Shape[] {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const shapes: Shape[] = [];
  for (const off of centeredOffsets(w / 2, s.gridSpacing, false)) {
    shapes.push({ kind: "line", x1: cx + off, y1: y, x2: cx + off, y2: y + h });
  }
  for (const off of centeredOffsets(h / 2, s.gridSpacing, false)) {
    shapes.push({ kind: "line", x1: x, y1: cy + off, x2: x + w, y2: cy + off });
  }
  return shapes;
}

function dotGrid(s: EffectSettings, rect: Rect): Shape[] {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = s.dotDiameter / 2;
  const shapes: Shape[] = [];
  const xs = centeredOffsets(w / 2, s.dotPitch, true).map((off) => cx + off);
  const ys = centeredOffsets(h / 2, s.dotPitch, true).map((off) => cy + off);
  for (const dx of xs) {
    for (const dy of ys) {
      shapes.push({ kind: "circle", cx: dx, cy: dy, r });
    }
  }
  // Corner points are always marked so the extent is recoverable on the blank page.
  for (const [px, py] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ] as const) {
    shapes.push({ kind: "circle", cx: px, cy: py, r });
  }
  return shapes;
}

export function effectShapes(kind: EffectKind, settings: EffectSettings, rect: Rect): Shape[] {
  if (kind === "none") return [];
  const shapes: Shape[] = settings.border
    ? [{ kind: "rect", x: rect.x, y: rect.y, w: rect.w, h: rect.h }]
    : [];
  switch (kind) {
    case "crosshair":
      return [...shapes, ...crosshair(settings, rect)];
    case "corner-x":
      return [...shapes, ...cornerX(settings, rect)];
    case "grid":
      return [...shapes, ...grid(settings, rect)];
    case "dot-grid":
      return [...shapes, ...dotGrid(settings, rect)];
  }
}
