/**
 * Impose a leaf sequence onto printed sheet faces for saddle-folded
 * signatures. Pure math: given a leaf count and sizes, produce a plan of
 * faces, each a list of (leaf index, x offset) placements. Rendering walks
 * the plan; nothing here draws anything.
 *
 * Ported from crosshair_print/imposition.py (fold_plan) and generalized from
 * one folded stack to N signatures: the leaf sequence is split into
 * consecutive runs, each imposed as its own saddle-fold booklet, and the
 * bound book is the signatures stacked in order.
 */

/**
 * Physical sheets stapled together per signature. The book is padded with
 * blank leaves so every signature is exactly this size.
 */
export const SHEETS_PER_SIGNATURE = 4;

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
  /** Total leaf slots including padding blanks. */
  paddedLeafCount: number;
}

/**
 * Saddle-fold imposition for the whole book, in signatures of exactly
 * SHEETS_PER_SIGNATURE sheets (the book is padded with blanks to fill the
 * last signature).
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
): ImpositionPlan {
  const totalSheets = Math.max(1, Math.ceil(leafCount / 4));
  const signatureCount = Math.ceil(totalSheets / SHEETS_PER_SIGNATURE);
  const sheetsPerSignature = Array.from({ length: signatureCount }, () => SHEETS_PER_SIGNATURE);

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

  return { sheetSize, leafSize, faces, sheetsPerSignature, paddedLeafCount: start };
}

/**
 * "Signature-item" tag geometry, in points from the leaf's lower fore-edge
 * corner (away from the spine: lower-left on versos, lower-right on rectos).
 * Both renderers use it; the color is mirrored in index.css.
 */
export const PAGE_LABEL_STYLE = { size: 5, inset: 6, gray: 0.45 };

/**
 * "Signature-item" page tag (both 1-based) for a padded leaf slot, e.g.
 * "2-5" for the fifth page of the second signature. Printed on every page
 * so a folded stack can be checked against its signature and order.
 */
export function pageLabel(slot: number): string {
  const leavesPerSignature = SHEETS_PER_SIGNATURE * 4;
  return `${Math.floor(slot / leavesPerSignature) + 1}-${(slot % leavesPerSignature) + 1}`;
}
