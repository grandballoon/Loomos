import { describe, expect, it } from "vitest";

import {
  cardUnit,
  cutLines,
  layoutCard,
  matchPreset,
  NOTEBOOK_PRESETS,
  paginate,
  placeImage,
  planCards,
  planSheet,
  PRINTER_PRESETS,
  rasterPlan,
  type Card,
  type CardOptions,
  type Size,
} from "./cards";
import type { Rect } from "./effects";
import { toPoints } from "./lengths";

const mm = (v: number) => toPoints(v, "mm");
const paper = (name: string): Size => NOTEBOOK_PRESETS.find((p) => p.name === name)!.size;
const printer = (name: string): Size => PRINTER_PRESETS.find((p) => p.name === name)!.size;
const LETTER = printer("letter");
const MARGIN = mm(5);

function inside(r: Rect, sheet: Size, margin: number): boolean {
  const e = 1e-6;
  return (
    r.x >= margin - e &&
    r.y >= margin - e &&
    r.x + r.w <= sheet.w - margin + e &&
    r.y + r.h <= sheet.h - margin + e
  );
}

function overlap(a: Rect, b: Rect): boolean {
  const e = 1e-6;
  return a.x + e < b.x + b.w && b.x + e < a.x + a.w && a.y + e < b.y + b.h && b.y + e < a.y + a.h;
}

function sheetsOf(images: Size[], options: CardOptions): Card[][] {
  const plan = planCards(images, options);
  if (!plan.ok) throw new Error(plan.error);
  return plan.sheets;
}

const sortedPair = (s: Size) => [Math.min(s.w, s.h), Math.max(s.w, s.h)];

describe("planSheet", () => {
  it.each([
    ["a4", 0],
    ["a5", 1],
    ["a6", 2],
    ["a7", 5],
    ["4x6", 3],
    ["3x5", 5],
  ])("fits %s cards per letter sheet: %i", (name, expected) => {
    expect(planSheet(paper(name), LETTER, MARGIN)).toHaveLength(expected);
  });

  it("fits four A6 on an A4 sheet with no margin", () => {
    expect(planSheet(paper("a6"), printer("a4"), 0)).toHaveLength(4);
  });

  it("prefers a mixed-orientation layout over a pure grid", () => {
    // 60x100 cards on 200x170: pure grids give 4 or 3; a portrait row (100
    // tall) leaves 70, which holds a landscape row of 2, so 5.
    const slots = planSheet({ w: 60, h: 100 }, { w: 200, h: 170 }, 0);
    expect(slots).toHaveLength(5);
    expect(new Set(slots.map((r) => r.w > r.h))).toEqual(new Set([true, false]));
  });

  for (const p of NOTEBOOK_PRESETS) {
    for (const s of PRINTER_PRESETS) {
      it(`keeps ${p.name} slots inside the margin and disjoint on ${s.name}`, () => {
        const slots = planSheet(p.size, s.size, MARGIN);
        for (const slot of slots) {
          expect(inside(slot, s.size, MARGIN)).toBe(true);
          expect(sortedPair(slot)[0]).toBeCloseTo(p.size.w, 6);
          expect(sortedPair(slot)[1]).toBeCloseTo(p.size.h, 6);
        }
        slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
      });
    }
  }

  it("centres the layout on the sheet", () => {
    const slots = planSheet(paper("a6"), LETTER, MARGIN);
    const left = Math.min(...slots.map((s) => s.x));
    const right = LETTER.w - Math.max(...slots.map((s) => s.x + s.w));
    const bottom = Math.min(...slots.map((s) => s.y));
    const top = LETTER.h - Math.max(...slots.map((s) => s.y + s.h));
    expect(left).toBeCloseTo(right, 6);
    expect(bottom).toBeCloseTo(top, 6);
  });

  it("returns slots in reading order", () => {
    const slots = planSheet(paper("a7"), LETTER, MARGIN);
    const round3 = (v: number) => Math.round(v * 1000) / 1000;
    const keys = slots.map((s) => [-round3(s.y + s.h), round3(s.x)]);
    const sortedKeys = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(keys).toEqual(sortedKeys);
  });
});

describe("presets", () => {
  it("matches a preset in either orientation", () => {
    expect(matchPreset(NOTEBOOK_PRESETS, { w: mm(210), h: mm(148) })?.name).toBe("a5");
    expect(matchPreset(PRINTER_PRESETS, { w: 792, h: 612 })?.name).toBe("letter");
    expect(matchPreset(NOTEBOOK_PRESETS, { w: 100, h: 100 })).toBeUndefined();
  });
});

describe("paginate", () => {
  it("splits indices into per-sheet chunks", () => {
    expect(paginate(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(paginate(0, 3)).toEqual([]);
  });
});

describe("placeImage", () => {
  it("fits with padding, centred", () => {
    // Inner box 90x140; a 1:2 image is limited by height: 70x140.
    expect(placeImage({ x: 0, y: 0, w: 100, h: 150 }, 1000, 2000, false, 5, false)).toEqual({
      rect: { x: 15, y: 5, w: 70, h: 140 },
      rotate: false,
      crop: [0, 0, 1, 1],
    });
  });

  it("swaps dimensions when rotated", () => {
    const p = placeImage({ x: 0, y: 0, w: 100, h: 150 }, 3000, 2000, true, 5, false);
    expect(p.rect.w).toBeCloseTo(90);
    expect(p.rect.h).toBeCloseTo(135);
  });

  it("fill covers the inner area and crops", () => {
    const p = placeImage({ x: 10, y: 20, w: 100, h: 150 }, 1000, 1000, false, 5, true);
    expect(p.rect).toEqual({ x: 15, y: 25, w: 90, h: 140 });
    const [l, t, r, b] = p.crop;
    expect([t, b]).toEqual([0, 1]);
    expect(r - l).toBeCloseTo(90 / 140);
  });

  it("fill crop with rotation uses the source orientation", () => {
    // A 2:1 landscape source into a portrait 90x140 box: rotated, so the
    // source is cropped to 140:90 (wider than tall).
    const [l, t, r, b] = placeImage({ x: 0, y: 0, w: 100, h: 150 }, 2000, 1000, true, 5, true).crop;
    expect(((r - l) * 2000) / ((b - t) * 1000)).toBeCloseTo(140 / 90);
  });
});

describe("cards and tabs", () => {
  const A6 = { w: 105, h: 148 };

  it("card unit follows the image orientation and adds the tab", () => {
    expect(cardUnit(A6, 1000, 2000, 25.4)).toEqual({ w: 105, h: 148 + 25.4 });
    expect(cardUnit(A6, 2000, 1000, 25.4)).toEqual({ w: 148, h: 105 + 25.4 });
    expect(cardUnit(A6, 1000, 1000, 0)).toEqual({ w: 105, h: 148 });
  });

  it("an upright card puts the tab below the face", () => {
    const card = layoutCard(0, { x: 0, y: 0, w: 105, h: 173.4 }, { w: 105, h: 173.4 }, { w: 1000, h: 2000 }, 2, 25.4, false);
    expect(card.face).toEqual({ x: 0, y: 25.4, w: 105, h: 148 });
    expect(card.fold).toEqual({ x1: 0, y1: 25.4, x2: 105, y2: 25.4 });
    expect(card.image.rotate).toBe(false);
    expect(card.image.rect.y).toBeGreaterThanOrEqual(card.face.y + 2);
  });

  it("a rotated card puts the tab on the right", () => {
    const card = layoutCard(0, { x: 0, y: 0, w: 173.4, h: 105 }, { w: 105, h: 173.4 }, { w: 1000, h: 2000 }, 2, 25.4, false);
    expect(card.face.w).toBeCloseTo(148);
    expect(card.face.h).toBe(105);
    expect(card.fold!.x1).toBeCloseTo(148);
    expect(card.fold!.x2).toBeCloseTo(148);
    expect(card.image.rotate).toBe(true);
    expect(card.image.rect.x + card.image.rect.w).toBeLessThanOrEqual(148 - 2 + 1e-9);
  });

  it("without a tab there is no fold and the face is the slot", () => {
    const card = layoutCard(0, { x: 0, y: 0, w: 148, h: 105 }, { w: 105, h: 148 }, { w: 1000, h: 2000 }, 2, 0, false);
    expect(card.fold).toBeNull();
    expect(card.face).toEqual({ x: 0, y: 0, w: 148, h: 105 });
    expect(card.image.rotate).toBe(true);
  });
});

describe("planCards", () => {
  const base = (name: string, tab: number): CardOptions => ({
    paper: paper(name),
    sheet: LETTER,
    margin: MARGIN,
    padding: mm(2),
    tab,
    fill: false,
  });
  const sz = (w: number, h: number): Size => ({ w, h });

  it("keeps image order across orientations without a tab", () => {
    const images = [sz(100, 200), sz(200, 100), sz(100, 200), sz(200, 100), sz(150, 150)];
    const sheets = sheetsOf(images, base("a6", 0));
    expect(sheets.map((s) => s.map((c) => c.index))).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("groups by card shape with a tab", () => {
    const images = [sz(100, 200), sz(200, 100), sz(100, 200)];
    const tab = mm(25.4);
    const sheets = sheetsOf(images, base("a7", tab));
    expect(sheets.map((s) => s.map((c) => c.index))).toEqual([[0, 2], [1]]);
    for (const sheet of sheets) {
      for (const c of sheet) {
        expect(c.fold).not.toBeNull();
        const unit = cardUnit(paper("a7"), images[c.index].w, images[c.index].h, tab);
        expect(sortedPair(c.slot)[0]).toBeCloseTo(sortedPair(unit)[0], 6);
        expect(sortedPair(c.slot)[1]).toBeCloseTo(sortedPair(unit)[1], 6);
      }
    }
  });

  it("keeps tabbed cards inside the printable area", () => {
    for (const name of ["a6", "a7", "3x5"]) {
      for (const image of [sz(100, 200), sz(200, 100)]) {
        for (const sheet of sheetsOf(Array(6).fill(image), base(name, mm(25.4)))) {
          for (const c of sheet) expect(inside(c.slot, LETTER, MARGIN)).toBe(true);
        }
      }
    }
  });

  it("reports cards that do not fit", () => {
    expect(planCards([sz(100, 200)], base("a5", mm(80))).ok).toBe(false);
  });

  it("plans nothing for no images", () => {
    expect(planCards([], base("a6", 0))).toEqual({ ok: true, sheets: [] });
  });
});

describe("cutLines", () => {
  it("merges shared edges", () => {
    const lines = cutLines([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 10, y: 0, w: 10, h: 10 },
    ]);
    expect(lines).toEqual([
      { x1: 0, y1: 0, x2: 20, y2: 0 },
      { x1: 0, y1: 10, x2: 20, y2: 10 },
      { x1: 0, y1: 0, x2: 0, y2: 10 },
      { x1: 10, y1: 0, x2: 10, y2: 10 },
      { x1: 20, y1: 0, x2: 20, y2: 10 },
    ]);
  });
});

describe("rasterPlan", () => {
  it("downsamples to the dpi at print size", () => {
    // 2 in wide at 300 dpi = 600 px from a 3000 px source.
    const plan = rasterPlan({ rect: { x: 0, y: 0, w: 144, h: 96 }, rotate: false, crop: [0, 0, 1, 1] }, 3000, 2000, 300);
    expect(plan).toEqual({ sx: 0, sy: 0, sw: 3000, sh: 2000, outW: 600, outH: 400, rotate: false });
  });

  it("never upsamples", () => {
    const plan = rasterPlan({ rect: { x: 0, y: 0, w: 720, h: 480 }, rotate: false, crop: [0, 0, 1, 1] }, 300, 200, 300);
    expect([plan.outW, plan.outH]).toEqual([300, 200]);
  });

  it("crops in source pixels and swaps output dimensions when rotated", () => {
    const plan = rasterPlan({ rect: { x: 0, y: 0, w: 72, h: 144 }, rotate: true, crop: [0.25, 0, 0.75, 1] }, 4000, 1000, 300);
    // Crop keeps 2000x1000 source; rotated it shows 1000 wide x 2000 tall.
    expect([plan.sx, plan.sy, plan.sw, plan.sh]).toEqual([1000, 0, 2000, 1000]);
    expect([plan.outW, plan.outH]).toEqual([300, 600]);
  });
});
