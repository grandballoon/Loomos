import { describe, expect, it } from "vitest";

import { cardGuideLines, clipSegment, faceGuideLines, type GuideOptions } from "./cardGuides";

const NONE: GuideOptions = { cornerX: false, crosshair: false, grid: false, gridSpacing: 10 };
const face = { x: 0, y: 0, w: 100, h: 200 };

describe("faceGuideLines", () => {
  it("draws nothing when no guide is enabled", () => {
    expect(faceGuideLines(face, NONE)).toEqual([]);
  });

  it("corner X joins the face corners", () => {
    expect(faceGuideLines(face, { ...NONE, cornerX: true })).toEqual([
      { x1: 0, y1: 0, x2: 100, y2: 200 },
      { x1: 0, y1: 200, x2: 100, y2: 0 },
    ]);
  });

  it("crosshair runs top-to-bottom and side-to-side through the centre", () => {
    expect(faceGuideLines(face, { ...NONE, crosshair: true })).toEqual([
      { x1: 50, y1: 0, x2: 50, y2: 200 },
      { x1: 0, y1: 100, x2: 100, y2: 100 },
    ]);
  });

  it("grid is centred and leaves out the face edges", () => {
    const lines = faceGuideLines({ x: 0, y: 0, w: 40, h: 20 }, { ...NONE, grid: true, gridSpacing: 10 });
    const xs = lines.filter((l) => l.x1 === l.x2).map((l) => l.x1);
    const ys = lines.filter((l) => l.y1 === l.y2).map((l) => l.y1);
    expect(xs).toEqual([10, 20, 30]);
    expect(ys).toEqual([10]);
  });
});

describe("clipSegment", () => {
  const box = { x: 10, y: 10, w: 20, h: 20 };

  it("clips a diagonal to the box", () => {
    expect(clipSegment({ x1: 0, y1: 0, x2: 40, y2: 40 }, box)).toEqual({ x1: 10, y1: 10, x2: 30, y2: 30 });
  });

  it("drops segments that miss the box", () => {
    expect(clipSegment({ x1: 0, y1: 0, x2: 5, y2: 40 }, box)).toBeNull();
    expect(clipSegment({ x1: 0, y1: 50, x2: 40, y2: 50 }, box)).toBeNull();
  });

  it("drops segments that only touch a corner", () => {
    expect(clipSegment({ x1: 0, y1: 20, x2: 20, y2: 40 }, { x: 0, y: 0, w: 10, h: 10 })).toBeNull();
  });
});

describe("cardGuideLines", () => {
  it("keeps the part of the page X that crosses a letterboxed image", () => {
    // Page 100x200, image 80x40 centred: the diagonals (slope 2) cross the
    // image's top and bottom edges, 10 either side of the centre.
    const image = { x: 10, y: 80, w: 80, h: 40 };
    expect(cardGuideLines(face, image, { ...NONE, cornerX: true })).toEqual([
      { x1: 40, y1: 80, x2: 60, y2: 120 },
      { x1: 40, y1: 120, x2: 60, y2: 80 },
    ]);
  });

  it("drops grid lines that fall outside the image", () => {
    const image = { x: 10, y: 80, w: 80, h: 40 };
    const lines = cardGuideLines(face, image, { ...NONE, grid: true, gridSpacing: 30 });
    const xs = lines.filter((l) => l.x1 === l.x2).map((l) => l.x1);
    expect(xs).toEqual([20, 50, 80]);
    for (const l of lines) {
      expect(Math.min(l.x1, l.x2)).toBeGreaterThanOrEqual(image.x);
      expect(Math.max(l.y1, l.y2)).toBeLessThanOrEqual(image.y + image.h);
    }
  });
});
