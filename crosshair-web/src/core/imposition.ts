/**
 * Impose a leaf sequence onto printed sheet faces for folded signatures.
 * Pure math: given a leaf count and sizes, produce a plan of faces, each a
 * list of (leaf index, x offset) placements. Rendering walks the plan;
 * nothing here draws anything.
 *
 * Ported from crosshair_print/imposition.py (fold_plan) and generalized from
 * one folded stack to N signatures: the leaf sequence is split into
 * consecutive runs, each imposed as its own saddle-fold booklet, and the
 * bound book is the signatures stacked in order.
 */

import { signatureLetter, type BookStructure } from "./binding";

export interface Placement {
  /** Index into the book's leaf sequence, or null for a padding blank. */
  leaf: number | null;
  /** Padded leaf slot in the whole book; set even for padding blanks. */
  slot: number;
  x: number;
  y: number;
}

export interface SheetFace {
  /** Which signature (0-based) this face belongs to. */
  signature: number;
  side: "front" | "back";
  placements: Placement[];
}

export interface ImpositionPlan {
  /** Printed page size in points (the unfolded sheet). */
  sheetSize: { w: number; h: number };
  leafSize: { w: number; h: number };
  faces: SheetFace[];
  /** Physical sheets in each signature. */
  sheetsPerSignature: number[];
  /** Pages per signature (every signature is the same size). */
  leavesPerSignature: number;
  /** Total leaf slots including padding blanks. */
  paddedLeafCount: number;
}

/**
 * Saddle-fold imposition for the whole book, split into the signatures the
 * binding calls for (see bookStructure); the book is padded with blanks to
 * fill the last signature.
 *
 * Within a signature of N leaves (N a multiple of 4, padded with blanks),
 * sheet k of the signature carries leaves (N-2k+2, 2k-1) on its front and
 * (2k, N-2k+1) on its back (1-based), so folding the signature's stack in
 * half yields correct reading order. Faces alternate front, back, front,
 * back, so the PDF prints directly on a duplex printer.
 */
export function imposeSignatures(
  leafCount: number,
  leafSize: { w: number; h: number },
  sheetSize: { w: number; h: number },
  structure: BookStructure,
): ImpositionPlan {
  const sheetsPerSignature = Array.from(
    { length: structure.signatureCount },
    () => structure.sheetsPerSignature,
  );

  const xLeft = (sheetSize.w - 2 * leafSize.w) / 2;
  const xRight = xLeft + leafSize.w;
  const y = (sheetSize.h - leafSize.h) / 2;
  const place = (slot: number, x: number): Placement => ({
    leaf: slot < leafCount ? slot : null,
    slot,
    x,
    y,
  });

  const faces: SheetFace[] = [];
  let start = 0; // First leaf index of the current signature.
  sheetsPerSignature.forEach((sheets, signature) => {
    const n = sheets * 4;
    for (let k = 1; k <= sheets; k++) {
      faces.push({
        signature,
        side: "front",
        placements: [place(start + n - 2 * k + 1, xLeft), place(start + 2 * k - 2, xRight)],
      });
      faces.push({
        signature,
        side: "back",
        placements: [place(start + 2 * k - 1, xLeft), place(start + n - 2 * k, xRight)],
      });
    }
    start += n;
  });

  return {
    sheetSize,
    leafSize,
    faces,
    sheetsPerSignature,
    leavesPerSignature: structure.leavesPerSignature,
    paddedLeafCount: start,
  };
}

/**
 * Page tag geometry, in points from the leaf's lower fore-edge corner (away
 * from the spine: lower-left on versos, lower-right on rectos). Both
 * renderers use it; the color is mirrored in index.css.
 *
 * Leaf edges coincide with paper edges, so the inset must clear the
 * unprintable border of common printers (~4–5 mm): 14 pt ≈ 4.9 mm keeps the
 * tag printable while its cap height (~17.6 pt) still fits under the default
 * 18 pt page margin.
 */
export const PAGE_LABEL_STYLE = { size: 5, inset: 14, gray: 0.45 };

/** "Signature B · Sheet 2 · Back" per face; sheet numbers restart in each signature. */
export function faceCaptions(faces: SheetFace[]): string[] {
  const seen = new Map<number, number>();
  return faces.map((face) => {
    const faceInSignature = seen.get(face.signature) ?? 0;
    seen.set(face.signature, faceInSignature + 1);
    const sheet = Math.floor(faceInSignature / 2) + 1;
    const side = face.side === "front" ? "Front" : "Back";
    return `Signature ${signatureLetter(face.signature)} · Sheet ${sheet} · ${side}`;
  });
}
