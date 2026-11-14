# Crosshair — sketchbook press (webapp)

TypeScript webapp for printing reference images to draw from.
Drop images (or a folder) and press them one of two ways, chosen with the tabs in the masthead:

- **Card sheets** (default): each image on a card cut to an exact notebook page size (A5, A6, 4×6, …), tiled one-sided onto printer paper with dotted cut lines.
- **Bound book**: a folded-signature sketchbook (sewn, notch-bound, perfect bound or saddle stitched) with optional guide effects on each image and a matching formatted blank facing page.

## Run

```sh
npm install
npm run dev
```

```sh
npm test       # core unit tests (vitest)
npm run lint
npm run build
```

## Card sheets

- **Notebook page**: preset (A4–A7, 5×7, 4×6, 3×5) or custom width × height; cards turn to match each image's orientation.
- **Printer paper**: preset (Letter by default, Legal, Tabloid, A4, A3) or custom, plus the printer's unprintable margin.
- **Features**, in any combination:
  - **X crosshair**: the notebook page's corner-to-corner diagonals.
  - **T crosshair**: the page's centre lines, top to bottom and side to side.
  - **Grid**: a square grid centred on the page.
  - **Paper flip tab**: a strip (1 in by default) below the art, with a dotted fold line, for gluing the card into the notebook so it flips.
- Guides are defined on the notebook page and drawn only where they cross the art, so they line up with the same guides drawn on the blank page.
- The packer tries every two-block arrangement (a grid in one orientation plus the leftover strip in the other) and keeps the one with the most cards, centred on the sheet.
- Without a tab every card is the same shape and images keep their order; with one, portrait and landscape art pack onto separate sheets.
- Images are fitted whole inside a padding (or cropped to fill), rotated 90° when that suits the card, and resampled down to 300 dpi.

Print the exported PDF one-sided at Scale 100% / actual size, never "fit to page".

## Bound book

- The **print page** (width × height, presets or custom) is the unfolded sheet; it folds once into two book pages (leaves).
- **Binding** sets how sheets group into **signatures** (sheets nested and folded together), each imposed as its own folded booklet:
  - **Sewn signatures** (default): 4 sheets per signature, sewn through the folds, spine glued.
  - **Notch-bound signatures**: 4 sheets per signature, notched across the spine and glued.
  - **Perfect bound**: every sheet folded on its own, folds trimmed off, loose leaves glued.
  - **Saddle stitch**: all sheets nested into one signature and stapled at the fold (warns past 12 sheets).
- Choosing a binding widens the gutter to that method's minimum if it is narrower.
- Every page carries a light tag in its lower outer corner: signature letter plus page within the signature (A1, A2… A16, B1…), so folded signatures can be checked for order.
- The preview has four views: **Finished book** (turnable pages, with staples, thread or glued spine shown as bound), **Spreads**, **Assembly** (binding steps as a checklist, stack order, and how each signature's sheets nest, seen from the head) and **Printed sheets**.
- **Margin** is the outer three sides; **gutter** is the spine side, mirrored between left and right pages.
- Images scale to fit the content box (page minus margins), centered; a cover leaf keeps every image + facing page on one spread.

Print the exported PDF two-sided, flip on short edge, Scale 100%.

## UI feedback (dev only)

Open the dev server at `/ui-feedback` (e.g. http://localhost:5173/ui-feedback) to turn on the feedback overlay.
Hold ⌥ (Alt) to highlight what is under the pointer, and ⌥-click to leave a note on it.
Notes are saved to `ui-feedback.json` (gitignored) with the element's selector and the React source file:line that rendered it.
Ask Claude to "pull UI feedback" (the `ui-feedback` skill in `.claude/skills/`) to act on them; resolved notes show struck through in the overlay's list.
The overlay and its endpoint exist only in the dev server; the production build contains none of it.

- `feedback/core.ts` — pure note model, validation and file format.
- `feedback/plugin.ts` — Vite dev-server endpoint at `/__ui-feedback`.
- `src/dev/feedback/` — the overlay (element inspection, notes panel).

## Layout of `src/`

Functional core in `core/`, imperative shell in `core/*Pdf.ts`, `core/images.ts` and the React UI.
The SVG previews and the pdf-lib renderers draw the same values from the core, so the preview is exactly what prints.

- `core/lengths.ts` — units; everything internal is PDF points.
- `core/cards.ts` — card sheets: paper presets, card shapes (with tab), sheet packing, image placement, cut lines, raster plan (port of art-sheets `layout.py`).
- `core/cardGuides.ts` — X / T crosshair and grid guides on the notebook page, clipped to the art.
- `core/cardScene.ts` — everything drawn on one card sheet, shared by preview and PDF.
- `core/cardsPdf.ts` — pdf-lib rendering of card sheets (lazy-loaded at export).
- `core/effects.ts` — book effect geometry (port of `crosshair_print/overlays.py`).
- `core/book.ts` — leaf model and book assembly (port of `leaves.py`/`book.py`).
- `core/binding.ts` — binding methods, signature structure, page tags (A1, B3…), spread positions.
- `core/imposition.ts` — signature-aware fold imposition.
- `core/pdf.ts` — pdf-lib rendering of the imposed book (lazy-loaded at export).
- `core/images.ts` — drag-and-drop intake, decoding, natural sort, image bytes for the PDF.
- `items.ts` — pure operations on the image list (reorder, per-image and apply-to-all effects).
- `App.tsx` — shell: images, intake, mode; `ui/CardsWorkspace.tsx` and `ui/BookWorkspace.tsx` own each press's layout and export.
- `ui/book/` — the bound book's preview views; `viewerState.ts` is the page-turning viewer's pure state machine.
