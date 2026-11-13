import { describe, expect, it } from "vitest";

import { layoutCard } from "./cards";
import { sheetScene } from "./cardScene";

const guides = { cornerX: true, crosshair: false, grid: false, gridSpacing: 10 };

describe("sheetScene", () => {
  it("draws images, clipped guides, cut lines and tab folds", () => {
    const card = layoutCard(3, { x: 0, y: 0, w: 100, h: 150 }, { w: 100, h: 150 }, { w: 100, h: 100 }, 0, 50, false);
    const scene = sheetScene([card], guides);
    expect(scene.images).toEqual([{ index: 3, placement: card.image }]);
    // Square image fills the 100x100 face exactly, so the X spans the image.
    expect(scene.guides).toEqual([
      { x1: 0, y1: 50, x2: 100, y2: 150 },
      { x1: 0, y1: 150, x2: 100, y2: 50 },
    ]);
    // Four cut edges plus the fold.
    expect(scene.dotted).toHaveLength(5);
    expect(scene.dotted).toContainEqual({ x1: 0, y1: 50, x2: 100, y2: 50 });
  });

  it("has no guides when none are enabled", () => {
    const card = layoutCard(0, { x: 0, y: 0, w: 100, h: 150 }, { w: 100, h: 150 }, { w: 100, h: 200 }, 5, 0, false);
    expect(sheetScene([card], { ...guides, cornerX: false }).guides).toEqual([]);
  });
});
