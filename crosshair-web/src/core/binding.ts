/**
 * Bookbinding methods and the signature structure each implies.
 *
 * A signature is a stack of sheets nested and folded together. Every method
 * here prints two leaves per sheet side and folds each sheet once; they
 * differ in how many sheets nest per signature and how the signatures are
 * joined. Pure values only: imposition, previews and print notes read these.
 */

import { toPoints } from "./lengths";

export type BindingMethod = "sewn" | "notch" | "perfect" | "saddle";

export const BINDING_METHODS: readonly BindingMethod[] = ["sewn", "notch", "perfect", "saddle"];

/** Sheets nested per signature for the multi-signature methods. */
export const SHEETS_PER_SIGNATURE = 4;

/** Saddle-stitched books thicker than this no longer fold or close well. */
export const SADDLE_MAX_SHEETS = 12;

export interface BindingInfo {
  label: string;
  /** One-line description for the settings panel. */
  summary: string;
  /** Smallest spine margin that stays readable once bound. */
  minGutter: number;
  /** Whether the bound book opens flat (drives the viewer's gutter shading). */
  opensFlat: boolean;
  /** What joins the signatures, as seen in the bound book. */
  spine: "staples" | "thread" | "glue";
  /** Assembly steps, in order, for the print notes and assembly guide. */
  steps: string[];
}

export const BINDING_INFO: Record<BindingMethod, BindingInfo> = {
  sewn: {
    label: "Sewn signatures",
    summary: `Signatures of ${SHEETS_PER_SIGNATURE} sheets, sewn through the folds, spine glued. Strongest; opens flat.`,
    minGutter: toPoints(0.5, "in"),
    opensFlat: true,
    spine: "thread",
    steps: [
      "Print two-sided, flip on short edge, Scale 100%.",
      `Collate each signature: ${SHEETS_PER_SIGNATURE} sheets, sheet 1 outermost.`,
      "Fold each signature in half and check its tags read A1, A2, A3… in order.",
      "Stack the signatures A, B, C… and pierce matching sewing stations along each fold.",
      "Sew each signature through its fold, linking it to the one before at head and tail.",
      "Glue the spine, add a strip of mull, then case or wrap it in a cover.",
    ],
  },
  notch: {
    label: "Notch-bound signatures",
    summary: `Signatures of ${SHEETS_PER_SIGNATURE} sheets kept folded; notches cut across the spine let glue into every sheet.`,
    minGutter: toPoints(0.5, "in"),
    opensFlat: false,
    spine: "glue",
    steps: [
      "Print two-sided, flip on short edge, Scale 100%.",
      `Collate each signature: ${SHEETS_PER_SIGNATURE} sheets, sheet 1 outermost.`,
      "Fold each signature in half and check its tags read A1, A2, A3… in order.",
      "Stack the signatures A, B, C…, jog the spine square and clamp.",
      "Saw shallow notches across the spine every 1–2 cm, through the folds.",
      "Work PVA glue into the notches and spine, add mull, then wrap in a cover.",
    ],
  },
  perfect: {
    label: "Perfect bound",
    summary: "Each sheet folded on its own and stacked; folds trimmed off and the loose leaves glued.",
    minGutter: toPoints(0.625, "in"),
    opensFlat: false,
    spine: "glue",
    steps: [
      "Print two-sided, flip on short edge, Scale 100%.",
      "Fold every sheet in half on its own; each one is a four-page signature.",
      "Stack them A, B, C… and check the tags read A1–A4, B1–B4… in order.",
      "Clamp the stack and trim about 2 mm off the folded spine edge.",
      "Rough up the spine, brush on PVA glue in thin coats and add mull.",
      "Wrap a cover around the glued spine and press until dry.",
    ],
  },
  saddle: {
    label: "Saddle stitch",
    summary: `All sheets nested into one signature and stapled at the fold. Best up to ${SADDLE_MAX_SHEETS} sheets.`,
    minGutter: toPoints(0.25, "in"),
    opensFlat: true,
    spine: "staples",
    steps: [
      "Print two-sided, flip on short edge, Scale 100%.",
      "Nest every sheet in print order, sheet 1 outermost.",
      "Fold the whole stack in half and check the tags read A1, A2, A3… in order.",
      "Staple twice through the fold from the outside, a quarter in from head and tail.",
    ],
  },
};

/** How a book of `leafCount` pages splits into printed sheets and signatures. */
export interface BookStructure {
  /** Sheets nested in each signature; every signature is the same size. */
  sheetsPerSignature: number;
  signatureCount: number;
  totalSheets: number;
  /** Pages (leaf faces) per signature: four per sheet. */
  leavesPerSignature: number;
  /** Pages including padding blanks. */
  paddedLeafCount: number;
}

export function bookStructure(method: BindingMethod, leafCount: number): BookStructure {
  const neededSheets = Math.max(1, Math.ceil(leafCount / 4));
  const sheetsPerSignature =
    method === "saddle" ? neededSheets : method === "perfect" ? 1 : SHEETS_PER_SIGNATURE;
  const signatureCount = Math.ceil(neededSheets / sheetsPerSignature);
  const totalSheets = signatureCount * sheetsPerSignature;
  return {
    sheetsPerSignature,
    signatureCount,
    totalSheets,
    leavesPerSignature: sheetsPerSignature * 4,
    paddedLeafCount: totalSheets * 4,
  };
}

/** Problems with a binding choice for this book, as user-facing text. */
export function bindingWarnings(method: BindingMethod, structure: BookStructure): string[] {
  if (method === "saddle" && structure.totalSheets > SADDLE_MAX_SHEETS) {
    return [
      `${structure.totalSheets} nested sheets is thick for one fold: the inner pages will creep and the staples may not hold. Sewn signatures suit a book this size.`,
    ];
  }
  return [];
}

/** Signature letter for a 0-based index: A…Z, then AA, AB… (bijective base 26). */
export function signatureLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Page tag for a padded leaf slot: signature letter plus page within the
 * signature, e.g. "B3" for the third page of the second signature. Printed
 * on every page so a folded stack can be checked against its order.
 */
export function pageLabel(slot: number, leavesPerSignature: number): string {
  return `${signatureLetter(Math.floor(slot / leavesPerSignature))}${(slot % leavesPerSignature) + 1}`;
}

/**
 * The gutter to use after switching binding: widened to the method's
 * minimum, never narrowed (a wider gutter is the user's choice).
 */
export function gutterForBinding(method: BindingMethod, gutter: number): number {
  return Math.max(gutter, BINDING_INFO[method].minGutter);
}

/** One sheet's place in its signature, for the assembly guide. */
export interface SheetInSignature {
  /** 1-based, outermost first. */
  sheet: number;
  /** Slots on the leaf in the first half of the signature (recto, verso). */
  outerLeaf: [number, number];
  /** Slots on the leaf in the second half of the signature (recto, verso). */
  innerLeaf: [number, number];
}

/**
 * The sheets of one signature, outermost first. Sheet k carries the leaf of
 * pages (2k-1, 2k) and its conjugate (n-2k+1, n-2k+2), 1-based, which is
 * what the imposition prints on its front and back.
 */
export function signatureSheets(signature: number, structure: BookStructure): SheetInSignature[] {
  const n = structure.leavesPerSignature;
  const start = signature * n;
  return Array.from({ length: structure.sheetsPerSignature }, (_, i) => {
    const k = i + 1;
    return {
      sheet: k,
      outerLeaf: [start + 2 * k - 2, start + 2 * k - 1],
      innerLeaf: [start + n - 2 * k, start + n - 2 * k + 1],
    };
  });
}

/** Where a reading-order spread sits in the bound book. */
export interface SpreadPosition {
  /** Signature of the spread's left and right pages (null when absent). */
  signatures: [number | null, number | null];
  /** The spread straddles a signature's centre fold, where its stitching shows. */
  centre: boolean;
  /** The two pages belong to different signatures (a seam between them). */
  seam: boolean;
}

export function spreadPosition(
  left: number | null,
  right: number | null,
  structure: BookStructure,
): SpreadPosition {
  const n = structure.leavesPerSignature;
  const sig = (slot: number | null) => (slot === null ? null : Math.floor(slot / n));
  const signatures: [number | null, number | null] = [sig(left), sig(right)];
  const both = left !== null && right !== null;
  return {
    signatures,
    centre: both && signatures[0] === signatures[1] && left! % n === n / 2 - 1,
    seam: both && signatures[0] !== signatures[1],
  };
}

/** Reading-order spreads over padded slots: cover alone, then (1,2), (3,4)… */
export function readingSpreads(paddedLeafCount: number): [number | null, number | null][] {
  const result: [number | null, number | null][] = [[null, 0]];
  for (let left = 1; left < paddedLeafCount; left += 2) {
    result.push([left, left + 1 < paddedLeafCount ? left + 1 : null]);
  }
  return result;
}

/** Viewer caption for reading-order spread `index`, e.g. "Pages 8–9 · A8 | A9 · centre of A". */
export function describeSpread(
  index: number,
  left: number | null,
  right: number | null,
  structure: BookStructure,
  method: BindingMethod,
): string {
  const n = structure.leavesPerSignature;
  if (left === null) return `Front cover · ${pageLabel(right ?? 0, n)}`;
  if (right === null) return `Back · ${pageLabel(left, n)}`;
  const parts = [`Pages ${2 * index}–${2 * index + 1}`, `${pageLabel(left, n)} | ${pageLabel(right, n)}`];
  const position = spreadPosition(left, right, structure);
  const [a, b] = position.signatures;
  if (position.centre) {
    const shown = { staples: "staples show here", thread: "sewing thread shows here", glue: "glued at the spine" };
    parts.push(`centre of ${signatureLetter(a!)}, ${shown[BINDING_INFO[method].spine]}`);
  } else if (position.seam) {
    parts.push(`between signatures ${signatureLetter(a!)} and ${signatureLetter(b!)}`);
  }
  return parts.join(" · ");
}
