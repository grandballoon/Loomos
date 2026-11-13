/**
 * Render planned card sheets to a one-sided, print-ready PDF with pdf-lib.
 *
 * Draws each sheet's scene (from cardScene.ts, the same values the preview
 * draws): placed images, guide lines over them, then dotted cut and fold
 * lines on top. Images are rasterized one at a time to keep memory flat.
 */

import { LineCapStyle, PDFDocument, grayscale, rgb } from "pdf-lib";

import type { Card, Size } from "./cards";
import type { GuideOptions } from "./cardGuides";
import { CUT_LINE_STYLE, sheetScene } from "./cardScene";
import type { Rgb } from "./effects";
import { placedImageBytes, type SourceImage } from "./images";

export interface CardsRenderInput {
  sheets: Card[][];
  sheetSize: Size;
  images: SourceImage[];
  guides: GuideOptions;
  guideColor: Rgb;
  guideThickness: number;
  dpi: number;
  title: string;
}

export async function renderCardsPdf(input: CardsRenderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  const guideColor = rgb(input.guideColor.r, input.guideColor.g, input.guideColor.b);

  for (const cards of input.sheets) {
    const page = doc.addPage([input.sheetSize.w, input.sheetSize.h]);
    const scene = sheetScene(cards, input.guides);

    for (const { index, placement } of scene.images) {
      const { bytes, format } = await placedImageBytes(input.images[index], placement, input.dpi);
      const image = format === "jpg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      const r = placement.rect;
      page.drawImage(image, { x: r.x, y: r.y, width: r.w, height: r.h });
    }

    for (const s of scene.guides) {
      page.drawLine({
        start: { x: s.x1, y: s.y1 },
        end: { x: s.x2, y: s.y2 },
        thickness: input.guideThickness,
        color: guideColor,
      });
    }

    for (const s of scene.dotted) {
      page.drawLine({
        start: { x: s.x1, y: s.y1 },
        end: { x: s.x2, y: s.y2 },
        thickness: CUT_LINE_STYLE.width,
        color: grayscale(CUT_LINE_STYLE.gray),
        dashArray: CUT_LINE_STYLE.dash,
        lineCap: LineCapStyle.Round,
      });
    }
  }

  return doc.save();
}
