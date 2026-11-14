/**
 * App-level state types and defaults. All lengths are stored in points; the
 * UI converts to and from the display unit at the input boundary.
 */

import type { BindingMethod } from "./core/binding";
import { NOTEBOOK_PRESETS, PRINTER_PRESETS, type Size } from "./core/cards";
import {
  DEFAULT_EFFECT_SETTINGS,
  type EffectKind,
  type EffectSettings,
  type Rgb,
} from "./core/effects";
import type { SourceImage } from "./core/images";
import { toPoints, type Unit } from "./core/lengths";

export interface ImageItem {
  source: SourceImage;
  effect: EffectKind;
}

export interface Settings {
  unit: Unit;
  /** Printed (unfolded) sheet size in points; leaves are half the width. */
  sheetW: number;
  sheetH: number;
  /** Outer margin (head, foot, fore edge) in points. */
  margin: number;
  /** Spine-side margin in points. */
  gutter: number;
  /** How the printed signatures are joined into a book. */
  binding: BindingMethod;
  /** Draw a formatted blank facing each image for copying against. */
  facingPages: boolean;
  imageSide: "left" | "right";
  title: string;
  defaultEffect: EffectKind;
  effectSettings: EffectSettings;
}

export interface PagePreset {
  name: string;
  label: string;
  sheetW: number;
  sheetH: number;
  leafLabel: string;
}

export const PAGE_PRESETS: PagePreset[] = [
  {
    name: "letter",
    label: "Letter 11×8.5 in",
    sheetW: toPoints(11, "in"),
    sheetH: toPoints(8.5, "in"),
    leafLabel: "half-letter pages",
  },
  {
    name: "a4",
    label: "A4 297×210 mm",
    sheetW: toPoints(297, "mm"),
    sheetH: toPoints(210, "mm"),
    leafLabel: "A5 pages",
  },
  {
    name: "a5",
    label: "A5 210×148 mm",
    sheetW: toPoints(210, "mm"),
    sheetH: toPoints(148, "mm"),
    leafLabel: "A6 pages",
  },
  {
    name: "tabloid",
    label: "Tabloid 17×11 in",
    sheetW: toPoints(17, "in"),
    sheetH: toPoints(11, "in"),
    leafLabel: "letter pages",
  },
];

export const DEFAULT_SETTINGS: Settings = {
  unit: "in",
  sheetW: PAGE_PRESETS[0].sheetW,
  sheetH: PAGE_PRESETS[0].sheetH,
  margin: toPoints(0.25, "in"),
  gutter: toPoints(0.5, "in"),
  binding: "sewn",
  facingPages: true,
  imageSide: "left",
  title: "Sketchbook",
  defaultEffect: "crosshair",
  effectSettings: DEFAULT_EFFECT_SETTINGS,
};

/** Which press the app is in: card sheets (default) or the bound book. */
export type Mode = "cards" | "book";

/** Guides to draw over each card's art, plus the flip-tab layout option. */
export interface CardFeatures {
  cornerX: boolean;
  crosshair: boolean;
  grid: boolean;
  flipTab: boolean;
}

export interface CardSettings {
  unit: Unit;
  /** Notebook page size (portrait), points. */
  notebook: Size;
  /** Printer paper size, points. */
  sheet: Size;
  /** Unprintable printer border kept clear of cards. */
  margin: number;
  /** White space between the cut line and the image. */
  padding: number;
  features: CardFeatures;
  /** Flip-tab strip height below the art. */
  tabHeight: number;
  gridSpacing: number;
  /** Crop images to fill the card instead of fitting them whole. */
  fill: boolean;
  guideColor: Rgb;
  guideThickness: number;
}

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  unit: "in",
  notebook: NOTEBOOK_PRESETS.find((preset) => preset.name === "a6")!.size,
  sheet: PRINTER_PRESETS[0].size,
  margin: toPoints(5, "mm"),
  padding: toPoints(2.5, "mm"),
  features: { cornerX: true, crosshair: false, grid: false, flipTab: false },
  tabHeight: toPoints(1, "in"),
  gridSpacing: toPoints(0.5, "in"),
  fill: false,
  guideColor: DEFAULT_EFFECT_SETTINGS.color,
  guideThickness: DEFAULT_EFFECT_SETTINGS.thickness,
};
