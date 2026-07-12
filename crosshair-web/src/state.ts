/**
 * App-level state types and defaults. All lengths are stored in points; the
 * UI converts to and from the display unit at the input boundary.
 */

import { DEFAULT_EFFECT_SETTINGS, type EffectKind, type EffectSettings } from "./core/effects";
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
  signatures: number;
  /** One folded sheet (4 pages) per signature; overrides the count. */
  fourPageSignatures: boolean;
  /** Outer margin (head, foot, fore edge) in points. */
  margin: number;
  /** Spine-side margin in points. */
  gutter: number;
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
  signatures: 1,
  fourPageSignatures: true,
  margin: toPoints(0.25, "in"),
  gutter: toPoints(0.5, "in"),
  facingPages: true,
  imageSide: "left",
  title: "Sketchbook",
  defaultEffect: "crosshair",
  effectSettings: DEFAULT_EFFECT_SETTINGS,
};
