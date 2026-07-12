# Crosshair — sketchbook press (webapp)

TypeScript webapp refactor of the `crosshair_print` CLI.
Drop images (or a folder) and get a saddle-fold, signature-bound sketchbook PDF at true scale, with optional guide effects (crosshair, corner X, grid, dot grid) on each image and a matching formatted blank facing page to draw against.

## Run

```sh
npm install
npm run dev
```

## Model

- The **print page** (width × height, presets or custom) is the unfolded sheet; it folds once into two book pages (leaves).
- The book is split into N **signatures**; each is imposed as its own saddle-fold booklet, stacked in order and stapled at the fold.
- **Margin** is the outer three sides; **gutter** is the spine side, mirrored between left and right pages.
- Images scale to fit the content box (page minus margins), centered; a cover leaf keeps every image + facing page on one spread.
- Effects are pure shape functions shared by the SVG preview and the pdf-lib renderer, so the preview is exactly what prints.

## Layout of `src/`

- `core/lengths.ts` — units; everything internal is PDF points.
- `core/effects.ts` — effect geometry (port of `crosshair_print/overlays.py`).
- `core/book.ts` — leaf model and book assembly (port of `leaves.py`/`book.py`).
- `core/imposition.ts` — signature-aware saddle-fold imposition (generalized `imposition.py`).
- `core/images.ts` — drag-and-drop intake, decoding, natural sort.
- `core/pdf.ts` — pdf-lib rendering of the imposed plan (lazy-loaded at export).
- `ui/`, `App.tsx`, `state.ts` — React UI.

Print the exported PDF two-sided, flip on short edge, Scale 100%.
