/**
 * Alignment guides for card sheets.
 *
 * Guides are defined on the card's face (the notebook page), not on the
 * image: the corner X runs between the page's corners, the crosshair through
 * the page's centre, and the grid is centred on the page. Each line is then
 * clipped to the image, so the printed art carries exactly the part of the
 * page's guides that crosses it. Draw the same guides on the blank notebook
 * page (corner-to-corner needs no measuring) and the art lines up with it.
 *
 * Pure: (face, image rect, options) in, line segments out.
 */

import type { Segment } from "./cards";
import { centeredOffsets, type Rect } from "./effects";

export interface GuideOptions {
  /** Corner-to-corner diagonals of the page. */
  cornerX: boolean;
  /** Upright crosshair: top-to-bottom and side-to-side through the centre. */
  crosshair: boolean;
  /** Square grid centred on the page. */
  grid: boolean;
  /** Grid cell size, points. */
  gridSpacing: number;
}

/** Lines of the enabled guides over the whole face, before clipping. */
export function faceGuideLines(face: Rect, options: GuideOptions): Segment[] {
  const { x, y, w, h } = face;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lines: Segment[] = [];
  if (options.cornerX) {
    lines.push({ x1: x, y1: y, x2: x + w, y2: y + h });
    lines.push({ x1: x, y1: y + h, x2: x + w, y2: y });
  }
  if (options.crosshair) {
    lines.push({ x1: cx, y1: y, x2: cx, y2: y + h });
    lines.push({ x1: x, y1: cy, x2: x + w, y2: cy });
  }
  if (options.grid && options.gridSpacing > 0) {
    for (const off of centeredOffsets(w / 2, options.gridSpacing, false)) {
      lines.push({ x1: cx + off, y1: y, x2: cx + off, y2: y + h });
    }
    for (const off of centeredOffsets(h / 2, options.gridSpacing, false)) {
      lines.push({ x1: x, y1: cy + off, x2: x + w, y2: cy + off });
    }
  }
  return lines;
}

const MIN_LENGTH = 1e-6;

/** Liang–Barsky: the part of a segment inside a rect, or null if none. */
export function clipSegment(s: Segment, r: Rect): Segment | null {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, s.x1 - r.x],
    [dx, r.x + r.w - s.x1],
    [-dy, s.y1 - r.y],
    [dy, r.y + r.h - s.y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // parallel to this edge and outside it
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if ((t1 - t0) * Math.hypot(dx, dy) < MIN_LENGTH) return null;
  return {
    x1: s.x1 + t0 * dx,
    y1: s.y1 + t0 * dy,
    x2: s.x1 + t1 * dx,
    y2: s.y1 + t1 * dy,
  };
}

/** The enabled page guides, clipped to the image. */
export function cardGuideLines(face: Rect, image: Rect, options: GuideOptions): Segment[] {
  return faceGuideLines(face, options)
    .map((line) => clipSegment(line, image))
    .filter((line): line is Segment => line !== null);
}
