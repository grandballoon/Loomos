import { describe, expect, it } from "vitest";

import type { EffectKind } from "./core/effects";
import { moveItem, setAllEffects, setEffectAt, sharedEffect } from "./items";
import type { ImageItem } from "./state";

const item = (id: string, effect: EffectKind): ImageItem => ({
  source: { id, name: id, url: "", width: 1, height: 1 } as ImageItem["source"],
  effect,
});

describe("setAllEffects", () => {
  it("sets every image's effect", () => {
    const items = [item("a", "none"), item("b", "grid")];
    expect(setAllEffects(items, "corner-x").map((i) => i.effect)).toEqual(["corner-x", "corner-x"]);
  });

  it("keeps images that already match and leaves the input untouched", () => {
    const items = [item("a", "grid"), item("b", "none")];
    const next = setAllEffects(items, "grid");
    expect(next[0]).toBe(items[0]);
    expect(items[1].effect).toBe("none");
  });
});

describe("setEffectAt", () => {
  it("sets only the given image", () => {
    const items = [item("a", "none"), item("b", "none")];
    expect(setEffectAt(items, 1, "grid").map((i) => i.effect)).toEqual(["none", "grid"]);
  });
});

describe("sharedEffect", () => {
  it("returns the common effect", () => {
    expect(sharedEffect([item("a", "grid"), item("b", "grid")])).toBe("grid");
  });

  it("is undefined when mixed or empty", () => {
    expect(sharedEffect([item("a", "grid"), item("b", "none")])).toBeUndefined();
    expect(sharedEffect([])).toBeUndefined();
  });
});

describe("moveItem", () => {
  const ids = (items: ImageItem[]) => items.map((i) => i.source.id);
  const items = [item("a", "none"), item("b", "none"), item("c", "none")];

  it("moves up and down", () => {
    expect(ids(moveItem(items, 1, -1))).toEqual(["b", "a", "c"]);
    expect(ids(moveItem(items, 1, 1))).toEqual(["a", "c", "b"]);
  });

  it("ignores moves past either end", () => {
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 2, 1)).toBe(items);
  });
});
