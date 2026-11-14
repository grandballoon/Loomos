import { describe, expect, it } from "vitest";

import {
  bindingWarnings,
  bookStructure,
  describeSpread,
  gutterForBinding,
  pageLabel,
  readingSpreads,
  signatureLetter,
  signatureSheets,
  spreadPosition,
  BINDING_INFO,
} from "./binding";
import { imposeSignatures } from "./imposition";

describe("signatureLetter", () => {
  it("runs A–Z then AA, AB…", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(signatureLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});

describe("pageLabel", () => {
  it("is signature letter plus page within the signature", () => {
    expect(pageLabel(0, 16)).toBe("A1");
    expect(pageLabel(15, 16)).toBe("A16");
    expect(pageLabel(16, 16)).toBe("B1");
    expect(pageLabel(34, 16)).toBe("C3");
    expect(pageLabel(5, 4)).toBe("B2");
  });
});

describe("bookStructure", () => {
  it("uses four-sheet signatures for sewn and notch", () => {
    for (const method of ["sewn", "notch"] as const) {
      expect(bookStructure(method, 21)).toEqual({
        sheetsPerSignature: 4,
        signatureCount: 2,
        totalSheets: 8,
        leavesPerSignature: 16,
        paddedLeafCount: 32,
      });
    }
  });

  it("folds each sheet on its own for perfect binding", () => {
    expect(bookStructure("perfect", 21)).toEqual({
      sheetsPerSignature: 1,
      signatureCount: 6,
      totalSheets: 6,
      leavesPerSignature: 4,
      paddedLeafCount: 24,
    });
  });

  it("nests everything in one signature for saddle stitch", () => {
    expect(bookStructure("saddle", 21)).toEqual({
      sheetsPerSignature: 6,
      signatureCount: 1,
      totalSheets: 6,
      leavesPerSignature: 24,
      paddedLeafCount: 24,
    });
  });

  it("always has at least one sheet", () => {
    expect(bookStructure("sewn", 0).totalSheets).toBe(4);
    expect(bookStructure("saddle", 1).totalSheets).toBe(1);
  });
});

describe("bindingWarnings", () => {
  it("flags thick saddle-stitched books only", () => {
    expect(bindingWarnings("saddle", bookStructure("saddle", 48))).toEqual([]);
    expect(bindingWarnings("saddle", bookStructure("saddle", 49))).toHaveLength(1);
    expect(bindingWarnings("sewn", bookStructure("sewn", 200))).toEqual([]);
  });
});

describe("gutterForBinding", () => {
  it("widens to the method minimum but never narrows", () => {
    expect(gutterForBinding("perfect", 10)).toBe(BINDING_INFO.perfect.minGutter);
    expect(gutterForBinding("saddle", 100)).toBe(100);
  });
});

describe("signatureSheets", () => {
  const structure = bookStructure("sewn", 32);

  it("pairs each sheet's leaves, outermost first", () => {
    const labels = signatureSheets(1, structure).map((sheet) => ({
      sheet: sheet.sheet,
      outer: sheet.outerLeaf.map((slot) => pageLabel(slot, 16)),
      inner: sheet.innerLeaf.map((slot) => pageLabel(slot, 16)),
    }));
    expect(labels).toEqual([
      { sheet: 1, outer: ["B1", "B2"], inner: ["B15", "B16"] },
      { sheet: 2, outer: ["B3", "B4"], inner: ["B13", "B14"] },
      { sheet: 3, outer: ["B5", "B6"], inner: ["B11", "B12"] },
      { sheet: 4, outer: ["B7", "B8"], inner: ["B9", "B10"] },
    ]);
  });

  it("matches what the imposition prints on each sheet", () => {
    const plan = imposeSignatures(32, { w: 1, h: 1 }, { w: 2, h: 1 }, structure);
    const sheets = [0, 1].flatMap((signature) => signatureSheets(signature, structure));
    sheets.forEach((sheet, i) => {
      const [front, back] = [plan.faces[2 * i], plan.faces[2 * i + 1]];
      expect(front.placements.map((p) => p.slot)).toEqual([sheet.innerLeaf[1], sheet.outerLeaf[0]]);
      expect(back.placements.map((p) => p.slot)).toEqual([sheet.outerLeaf[1], sheet.innerLeaf[0]]);
    });
  });
});

describe("spreads", () => {
  const structure = bookStructure("sewn", 32);

  it("reads cover alone, then pairs, then the last page alone", () => {
    const spreads = readingSpreads(8);
    expect(spreads).toEqual([
      [null, 0],
      [1, 2],
      [3, 4],
      [5, 6],
      [7, null],
    ]);
  });

  it("finds signature centres and seams", () => {
    expect(spreadPosition(7, 8, structure)).toEqual({ signatures: [0, 0], centre: true, seam: false });
    expect(spreadPosition(15, 16, structure)).toEqual({ signatures: [0, 1], centre: false, seam: true });
    expect(spreadPosition(3, 4, structure)).toEqual({ signatures: [0, 0], centre: false, seam: false });
    expect(spreadPosition(null, 0, structure).centre).toBe(false);
  });

  it("describes spreads for the viewer", () => {
    expect(describeSpread(0, null, 0, structure, "sewn")).toBe("Front cover · A1");
    expect(describeSpread(4, 7, 8, structure, "sewn")).toBe(
      "Pages 8–9 · A8 | A9 · centre of A, sewing thread shows here",
    );
    expect(describeSpread(8, 15, 16, structure, "sewn")).toBe(
      "Pages 16–17 · A16 | B1 · between signatures A and B",
    );
    expect(describeSpread(16, 31, null, structure, "sewn")).toBe("Back · B16");
  });
});
