/**
 * Everything drawn on one card sheet, as plain values: the images to place,
 * the guide lines over them, and the dotted cut and fold lines. The SVG
 * preview and the pdf-lib renderer both draw exactly this, so the preview is
 * what prints.
 */

import { cardGuideLines, type GuideOptions } from "./cardGuides";
import { cutLines, type Card, type ImagePlacement, type Segment } from "./cards";

/** Dotted cut/fold line style, in points; round caps turn zero dashes into dots. */
export const CUT_LINE_STYLE = { gray: 0.45, width: 0.5, dash: [0, 2.2] as [number, number] };

export interface SheetScene {
  images: { index: number; placement: ImagePlacement }[];
  guides: Segment[];
  /** Cut lines (merged slot edges) and tab folds, all drawn dotted. */
  dotted: Segment[];
}

export function sheetScene(cards: Card[], guides: GuideOptions): SheetScene {
  return {
    images: cards.map((card) => ({ index: card.index, placement: card.image })),
    guides: cards.flatMap((card) => cardGuideLines(card.face, card.image.rect, guides)),
    dotted: [
      ...cutLines(cards.map((card) => card.slot)),
      ...cards.flatMap((card) => (card.fold ? [card.fold] : [])),
    ],
  };
}
