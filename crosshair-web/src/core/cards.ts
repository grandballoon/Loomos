/**
 * Card sheets: tile images onto one-sided printer sheets, each image on a
 * card cut to an exact notebook-paper size (A5, A6, 4x6, …), optionally with
 * a flip tab (hinge strip) below the art for gluing into the notebook.
 *
 * Pure layout core over plain values in points, y-up like PDF. No I/O, no
 * DOM. The SVG preview and the pdf-lib renderer both interpret the values
 * returned here, so the preview is exactly what prints.
 *
 * Ported from art-sheets (artsheets/layout.py).
 */

import type { Rect } from "./effects";
import { toPoints } from "./lengths";

export interface Size {
  w: number;
  h: number;
}

export interface SizePreset {
  name: string;
  label: string;
  /** Portrait (short × long) size in points. */
  size: Size;
}

const mm = (w: number, h: number): Size => ({ w: toPoints(w, "mm"), h: toPoints(h, "mm") });
const inch = (w: number, h: number): Size => ({ w: toPoints(w, "in"), h: toPoints(h, "in") });

export const NOTEBOOK_PRESETS: SizePreset[] = [
  { name: "a4", label: "A4 210×297 mm", size: mm(210, 297) },
  { name: "a5", label: "A5 148×210 mm", size: mm(148, 210) },
  { name: "a6", label: "A6 105×148 mm", size: mm(105, 148) },
  { name: "a7", label: "A7 74×105 mm", size: mm(74, 105) },
  { name: "5x7", label: "5×7 in", size: inch(5, 7) },
  { name: "4x6", label: "4×6 in", size: inch(4, 6) },
  { name: "3x5", label: "3×5 in", size: inch(3, 5) },
];

export const PRINTER_PRESETS: SizePreset[] = [
  { name: "letter", label: "Letter 8.5×11 in", size: inch(8.5, 11) },
  { name: "legal", label: "Legal 8.5×14 in", size: inch(8.5, 14) },
  { name: "tabloid", label: "Tabloid 11×17 in", size: inch(11, 17) },
  { name: "a4", label: "A4 210×297 mm", size: mm(210, 297) },
  { name: "a3", label: "A3 297×420 mm", size: mm(297, 420) },
];

/** The preset matching a size in either orientation, if any. */
export function matchPreset(presets: SizePreset[], size: Size): SizePreset | undefined {
  const [short, long] = sorted(size);
  return presets.find(
    (preset) => Math.abs(preset.size.w - short) < 0.5 && Math.abs(preset.size.h - long) < 0.5,
  );
}

const EPS = 1e-6;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Where an image goes inside its card face.
 *
 * `rect` is the drawn image rectangle on the sheet (already-rotated size).
 * `rotate` is true when the image is turned 90° counter-clockwise to match
 * its slot. `crop` is the (left, top, right, bottom) fraction of the source
 * image to keep, in the source's own (unrotated, top-down) orientation.
 */
export interface ImagePlacement {
  rect: Rect;
  rotate: boolean;
  crop: [number, number, number, number];
}

/**
 * One image's layout on a sheet.
 *
 * `slot` is the outer cut rectangle (paper + tab). `face` is the notebook
 * paper area. `fold` is the line between face and tab (null without a tab).
 * When `image.rotate` is true the whole card is turned 90° counter-clockwise,
 * so the art's bottom edge, and the tab, sit on the slot's right side.
 */
export interface Card {
  index: number;
  slot: Rect;
  face: Rect;
  fold: Segment | null;
  image: ImagePlacement;
}

export interface CardOptions {
  /** Notebook paper size, any orientation. */
  paper: Size;
  /** Printer sheet size, as it feeds. */
  sheet: Size;
  /** Unprintable printer border kept clear of cards. */
  margin: number;
  /** White space between the cut line and the image. */
  padding: number;
  /** Flip-tab height below the art; 0 for none. */
  tab: number;
  /** Crop images to cover the face instead of fitting them whole. */
  fill: boolean;
}

function sorted(size: Size): [number, number] {
  return size.w <= size.h ? [size.w, size.h] : [size.h, size.w];
}

/** How many (cols, rows) of cw × ch cards fit in areaW × areaH. */
function gridCount(areaW: number, areaH: number, cw: number, ch: number): [number, number] {
  if (cw <= 0 || ch <= 0) return [0, 0];
  return [Math.floor((areaW + EPS) / cw), Math.floor((areaH + EPS) / ch)];
}

/** Grid of rects, ordered top-to-bottom then left-to-right (reading order). */
function gridRects(x0: number, y0: number, cols: number, rows: number, cw: number, ch: number): Rect[] {
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: x0 + c * cw, y: y0 + (rows - 1 - r) * ch, w: cw, h: ch });
    }
  }
  return out;
}

/**
 * Two-block guillotine arrangements, origin at (0, 0) of the printable area.
 *
 * Block A: k full rows (or columns) of cards in one orientation, stacked at
 * the top (or left). Block B: the leftover strip filled with cards in the
 * other orientation. This covers pure grids (k = 0 or k = max) and the common
 * mixed layouts.
 */
function candidates(areaW: number, areaH: number, card: Size): Rect[][] {
  const orientations: [number, number][] = [
    [card.w, card.h],
    [card.h, card.w],
  ];
  const out: Rect[][] = [];
  for (const [[aw, ah], [bw, bh]] of [orientations, [orientations[1], orientations[0]]]) {
    // Stack rows: block A on top, block B below.
    const [colsA, maxRowsA] = gridCount(areaW, areaH, aw, ah);
    for (let k = 0; k <= maxRowsA; k++) {
      const used = k * ah;
      const [colsB, rowsB] = gridCount(areaW, areaH - used, bw, bh);
      out.push([
        ...(colsA ? gridRects(0, areaH - used, colsA, k, aw, ah) : []),
        ...gridRects(0, areaH - used - rowsB * bh, colsB, rowsB, bw, bh),
      ]);
    }
    // Side by side: block A on the left, block B on the right.
    const [maxColsA, rowsA] = gridCount(areaW, areaH, aw, ah);
    for (let k = 0; k <= maxColsA; k++) {
      const used = k * aw;
      const [colsB, rowsB] = gridCount(areaW - used, areaH, bw, bh);
      out.push([
        ...gridRects(0, areaH - rowsA * ah, k, rowsA, aw, ah),
        ...gridRects(used, areaH - rowsB * bh, colsB, rowsB, bw, bh),
      ]);
    }
  }
  return out;
}

function bounds(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Higher is better: most cards, then fewest orientations, then tightest block. */
function score(rects: Rect[]): [number, number, number] {
  const orientations = new Set(rects.map((r) => r.w > r.h)).size;
  const b = bounds(rects);
  return [rects.length, -orientations, -(b.w * b.h)];
}

function compareScores(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Card slots (card-sized rects, either orientation) for one sheet,
 * maximising the count. The arrangement is centred on the sheet, and slots
 * are in reading order (by top edge, then left edge). Returns [] when the
 * card cannot fit inside the printable area at all.
 */
export function planSheet(card: Size, sheet: Size, margin: number): Rect[] {
  const areaW = sheet.w - 2 * margin;
  const areaH = sheet.h - 2 * margin;
  if (areaW <= 0 || areaH <= 0) return [];
  let best: Rect[] | null = null;
  for (const layout of candidates(areaW, areaH, card)) {
    if (layout.length === 0) continue;
    // Strictly-better keeps the first of equal candidates, like Python's max().
    if (!best || compareScores(score(layout), score(best)) > 0) best = layout;
  }
  if (!best) return [];
  const b = bounds(best);
  const dx = (sheet.w - b.w) / 2 - b.x;
  const dy = (sheet.h - b.h) / 2 - b.y;
  return best
    .map((r) => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }))
    .sort((p, q) => round6(q.y + q.h) - round6(p.y + p.h) || round6(p.x) - round6(q.x));
}

/** Split indices 0..count-1 into consecutive chunks of at most perSheet. */
export function paginate(count: number, perSheet: number): number[][] {
  if (perSheet <= 0) throw new Error("perSheet must be positive");
  const out: number[][] = [];
  for (let i = 0; i < count; i += perSheet) {
    out.push(Array.from({ length: Math.min(perSheet, count - i) }, (_, j) => i + j));
  }
  return out;
}

/**
 * Upright (art-facing) size of one card: the paper turned to match the
 * image, plus a `tab`-high strip below the art's bottom edge. Square images
 * use portrait.
 */
export function cardUnit(paper: Size, imgW: number, imgH: number, tab: number): Size {
  const [short, long] = sorted(paper);
  const [w, h] = imgW > imgH ? [long, short] : [short, long];
  return { w, h: h + tab };
}

/** Fractional crop box of the source image that has width/height == aspect. */
function centreCrop(imgW: number, imgH: number, aspect: number): [number, number, number, number] {
  const src = imgW / imgH;
  if (src > aspect) {
    const keep = aspect / src; // too wide: trim the sides
    return [(1 - keep) / 2, 0, (1 + keep) / 2, 1];
  }
  const keep = src / aspect; // too tall: trim top and bottom
  return [0, (1 - keep) / 2, 1, (1 + keep) / 2];
}

/**
 * Fit an image inside the card face, leaving `padding` of white on every
 * side. `rotate` turns the image 90° counter-clockwise to match its card.
 * With `fill` it is centre-cropped to cover the whole inner area; otherwise
 * it is scaled to fit entirely (letterboxed).
 */
export function placeImage(
  face: Rect,
  imgW: number,
  imgH: number,
  rotate: boolean,
  padding: number,
  fill: boolean,
): ImagePlacement {
  const innerW = Math.max(face.w - 2 * padding, 0);
  const innerH = Math.max(face.h - 2 * padding, 0);
  // Image dimensions as they will appear on the sheet.
  const [iw, ih] = rotate ? [imgH, imgW] : [imgW, imgH];
  let crop: [number, number, number, number] = [0, 0, 1, 1];
  let w: number;
  let h: number;
  if (fill) {
    w = innerW;
    h = innerH;
    if (w && h) crop = centreCrop(imgW, imgH, rotate ? h / w : w / h);
  } else {
    const scale = Math.min(innerW / iw, innerH / ih);
    w = iw * scale;
    h = ih * scale;
  }
  return {
    rect: { x: face.x + (face.w - w) / 2, y: face.y + (face.h - h) / 2, w, h },
    rotate,
    crop,
  };
}

/** Split a slot into face and tab, and place the image on the face. */
export function layoutCard(
  index: number,
  slot: Rect,
  unit: Size,
  image: Size,
  padding: number,
  tab: number,
  fill: boolean,
): Card {
  const rotate = Math.abs(slot.w - unit.w) > EPS || Math.abs(slot.h - unit.h) > EPS;
  let face: Rect;
  let fold: Segment;
  if (rotate) {
    // Card turned counter-clockwise: the art's bottom faces right.
    face = { x: slot.x, y: slot.y, w: slot.w - tab, h: slot.h };
    fold = { x1: face.x + face.w, y1: slot.y, x2: face.x + face.w, y2: slot.y + slot.h };
  } else {
    face = { x: slot.x, y: slot.y + tab, w: slot.w, h: slot.h - tab };
    fold = { x1: slot.x, y1: face.y, x2: slot.x + slot.w, y2: face.y };
  }
  return {
    index,
    slot,
    face,
    fold: tab > 0 ? fold : null,
    image: placeImage(face, image.w, image.h, rotate, padding, fill),
  };
}

export type CardPlan =
  | { ok: true; sheets: Card[][] }
  | { ok: false; error: string };

/**
 * Lay out every image (given as pixel sizes) onto sheets.
 *
 * Images whose cards have the same shape (up to rotation) share sheets, in
 * order. Without a tab every card is the same shape, so order is fully
 * preserved; with one, portrait and landscape art pack onto separate sheets.
 * Fails (as a value) when a card does not fit on the sheet.
 */
export function planCards(images: Size[], options: CardOptions): CardPlan {
  const { paper, sheet, margin, padding, tab, fill } = options;
  const units = images.map((image) => cardUnit(paper, image.w, image.h, tab));
  const groups = new Map<string, { shape: Size; indices: number[] }>();
  units.forEach((unit, i) => {
    const [short, long] = sorted(unit);
    const key = `${short.toFixed(4)}x${long.toFixed(4)}`;
    const group = groups.get(key) ?? { shape: { w: short, h: long }, indices: [] };
    group.indices.push(i);
    groups.set(key, group);
  });

  const sheets: Card[][] = [];
  for (const { shape, indices } of groups.values()) {
    const slots = planSheet(shape, sheet, margin);
    if (slots.length === 0) {
      return { ok: false, error: "A card does not fit on the printer paper inside its margin." };
    }
    for (const chunk of paginate(indices.length, slots.length)) {
      sheets.push(
        chunk.map((j, k) => {
          const index = indices[j];
          return layoutCard(index, slots[k], units[index], images[index], padding, tab, fill);
        }),
      );
    }
  }
  return { ok: true, sheets };
}

function mergeSpans(spans: [number, number][]): [number, number][] {
  const merged: [number, number][] = [];
  for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0] || p[1] - q[1])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

/**
 * Union of all slot edges, merged so shared edges are drawn exactly once.
 * Overlapping collinear edges become one continuous segment, so a dotted
 * pattern stays even where neighbouring cards share a cut line.
 */
export function cutLines(slots: Rect[]): Segment[] {
  const horizontal = new Map<number, [number, number][]>();
  const vertical = new Map<number, [number, number][]>();
  const add = (map: Map<number, [number, number][]>, at: number, span: [number, number]) => {
    const key = Math.round(at * 1e4) / 1e4;
    map.set(key, [...(map.get(key) ?? []), span]);
  };
  for (const r of slots) {
    for (const y of [r.y, r.y + r.h]) add(horizontal, y, [r.x, r.x + r.w]);
    for (const x of [r.x, r.x + r.w]) add(vertical, x, [r.y, r.y + r.h]);
  }
  const out: Segment[] = [];
  for (const [y, spans] of [...horizontal].sort((p, q) => p[0] - q[0])) {
    for (const [a, b] of mergeSpans(spans)) out.push({ x1: a, y1: y, x2: b, y2: y });
  }
  for (const [x, spans] of [...vertical].sort((p, q) => p[0] - q[0])) {
    for (const [a, b] of mergeSpans(spans)) out.push({ x1: x, y1: a, x2: x, y2: b });
  }
  return out;
}

/**
 * Pixel plan for rasterizing a placed image: which source pixels to take and
 * the output bitmap size (already rotated), capped at `dpi` at print size.
 * Never upsamples: that adds bytes, not detail.
 */
export interface RasterPlan {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Output bitmap size, in the image's on-sheet orientation. */
  outW: number;
  outH: number;
  rotate: boolean;
}

export function rasterPlan(placement: ImagePlacement, srcW: number, srcH: number, dpi: number): RasterPlan {
  const [l, t, r, b] = placement.crop;
  const sx = Math.round(l * srcW);
  const sy = Math.round(t * srcH);
  const sw = Math.max(1, Math.round(r * srcW) - sx);
  const sh = Math.max(1, Math.round(b * srcH) - sy);
  // Cropped source size as it appears on the sheet.
  const [dispW, dispH] = placement.rotate ? [sh, sw] : [sw, sh];
  const targetW = (placement.rect.w / 72) * dpi;
  const scale = Math.min(1, targetW / dispW);
  return {
    sx,
    sy,
    sw,
    sh,
    outW: Math.max(1, Math.round(dispW * scale)),
    outH: Math.max(1, Math.round(dispH * scale)),
    rotate: placement.rotate,
  };
}
