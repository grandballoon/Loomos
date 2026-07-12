/**
 * Render an imposed book to a print-ready PDF with pdf-lib.
 *
 * Walks the imposition plan face by face and draws each referenced leaf at
 * its placement offset. Leaf drawing is coordinate-shifted by the placement,
 * so leaf code never knows whether it occupies a whole sheet or half of one.
 * Effects come from the same shape functions the preview renders, so the PDF
 * matches the on-screen preview exactly.
 */

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

import { leafContentRect, type Leaf, type PageGeometry, contentBox } from "./book";
import { effectShapes, type EffectSettings, type Rect } from "./effects";
import { pdfImageBytes, type SourceImage } from "./images";
import type { ImpositionPlan } from "./imposition";

const TITLE_STYLES: { bold: boolean; size: number }[] = [
  { bold: true, size: 16 },
  { bold: false, size: 10 },
  { bold: false, size: 8 },
];

export interface RenderInput {
  leaves: Leaf[];
  plan: ImpositionPlan;
  geometry: PageGeometry;
  images: SourceImage[];
  effectSettings: EffectSettings;
}

export async function renderBookPdf(input: RenderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  // Embed each referenced image once, keyed by its index in the image list.
  const embedded = new Map<number, PDFImage>();
  const referenced = new Set(
    input.leaves.filter((leaf) => leaf.kind === "image").map((leaf) => leaf.imageIndex!),
  );
  for (const index of referenced) {
    const { bytes, format } = await pdfImageBytes(input.images[index]);
    embedded.set(index, format === "jpg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes));
  }

  for (const face of input.plan.faces) {
    const page = doc.addPage([input.plan.sheetSize.w, input.plan.sheetSize.h]);
    for (const placement of face.placements) {
      if (placement.leaf === null) continue;
      const leaf = input.leaves[placement.leaf];
      if (!leaf) continue;
      drawLeaf(page, leaf, input, embedded, fonts, placement.x, placement.y);
    }
  }

  return doc.save();
}

function drawLeaf(
  page: PDFPage,
  leaf: Leaf,
  input: RenderInput,
  embedded: Map<number, PDFImage>,
  fonts: { regular: PDFFont; bold: PDFFont },
  ox: number,
  oy: number,
): void {
  if (leaf.kind === "blank") return;
  if (leaf.kind === "title") {
    drawTitle(page, leaf, input.geometry, fonts, ox, oy);
    return;
  }

  const rect = leafContentRect(leaf, input.geometry);
  if (!rect) return;
  const placed: Rect = { x: rect.x + ox, y: rect.y + oy, w: rect.w, h: rect.h };

  if (leaf.kind === "image" && leaf.imageIndex !== undefined) {
    const image = embedded.get(leaf.imageIndex);
    if (image) {
      page.drawImage(image, { x: placed.x, y: placed.y, width: placed.w, height: placed.h });
    }
  }

  const settings = input.effectSettings;
  const color = rgb(settings.color.r, settings.color.g, settings.color.b);
  for (const shape of effectShapes(leaf.effect ?? "none", settings, placed)) {
    switch (shape.kind) {
      case "line":
        page.drawLine({
          start: { x: shape.x1, y: shape.y1 },
          end: { x: shape.x2, y: shape.y2 },
          thickness: settings.thickness,
          color,
        });
        break;
      case "circle":
        page.drawCircle({ x: shape.cx, y: shape.cy, size: shape.r, color });
        break;
      case "rect":
        page.drawRectangle({
          x: shape.x,
          y: shape.y,
          width: shape.w,
          height: shape.h,
          borderWidth: settings.thickness,
          borderColor: color,
        });
        break;
    }
  }
}

function drawTitle(
  page: PDFPage,
  leaf: Leaf,
  geometry: PageGeometry,
  fonts: { regular: PDFFont; bold: PDFFont },
  ox: number,
  oy: number,
): void {
  const box = contentBox(geometry, leaf.role);
  const centerX = ox + box.x + box.w / 2;
  let baseline = oy + box.y + box.h * 0.62;

  (leaf.titleLines ?? []).forEach((text, index) => {
    const style = TITLE_STYLES[Math.min(index, TITLE_STYLES.length - 1)];
    const font = style.bold ? fonts.bold : fonts.regular;
    const width = font.widthOfTextAtSize(text, style.size);
    page.drawText(text, {
      x: centerX - width / 2,
      y: baseline,
      size: style.size,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= style.size * 2.2;
  });
}
