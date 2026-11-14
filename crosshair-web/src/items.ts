/**
 * Pure operations on the image list. The app shell holds the list in state
 * and applies these; they never mutate their input.
 */

import type { EffectKind } from "./core/effects";
import type { ImageItem } from "./state";

/** The list with every image set to `effect`. */
export function setAllEffects(items: ImageItem[], effect: EffectKind): ImageItem[] {
  return items.map((item) => (item.effect === effect ? item : { ...item, effect }));
}

/** The list with image `index` set to `effect`. */
export function setEffectAt(items: ImageItem[], index: number, effect: EffectKind): ImageItem[] {
  return items.map((item, i) => (i === index ? { ...item, effect } : item));
}

/** The effect every image shares, or undefined when empty or mixed. */
export function sharedEffect(items: ImageItem[]): EffectKind | undefined {
  const first = items[0]?.effect;
  return items.every((item) => item.effect === first) ? first : undefined;
}

/** The list with image `index` moved by `delta`; unchanged when out of range. */
export function moveItem(items: ImageItem[], index: number, delta: -1 | 1): ImageItem[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
