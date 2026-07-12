# Zine / Sketchbook Page Spec (v1.5): Bindable Pages with Selectable Formatting

## Status
This is the phase between v1 (single image, letter page, crosshair) and the folder-level batch construction described in `v2_spec.md`.
It defines how a single image becomes a *pair of book pages* — an image page and a matching formatted blank page — laid out for binding, stapling, or folding into a paper sketchbook.
The two phases are implemented together (decided); the folder phase feeds many images through this same page machinery, so everything here is designed as the per-image unit the batch orchestrator calls.
This document is the source of truth for this phase.

## Purpose
Turn each source image into printed pages suitable for assembling a physical sketchbook:

1. The image sits on a single page of *parameterized* width and height (no longer hardcoded letter).
2. The layout accounts for a binding edge (staple, stitch, or fold), with a gutter margin so content is not swallowed by the spine.
3. The image's registration/guide formatting is optional and selectable: crosshair (current), corner-to-corner X, adjustable line grid, or adjustable dot grid.
4. The blank page that faces each image in the bound book carries the *same* formatting at the *same* mirrored position, so the reader can draw a copy of the image against identical guides.

## Vocabulary
**Leaf** — one logical book page (what the reader sees as a single page when the book is open).
**Sheet** — one physical piece of paper coming out of the printer; a sheet carries two leaves (duplex) or four leaves (fold mode, two per side).
**Spread** — the verso (left) and recto (right) leaves visible together when the book lies open.
**Spine edge** — the leaf edge at the binding; **fore edge** — the opposite edge.
**Content box** — the rectangle on a leaf, inset by the gutter and outer margins, inside which the image (or its blank-page counterpart) is placed.

## Page geometry

### Parameterized leaf size
A new `--page WxH` option sets the leaf size with unit suffixes, e.g. `--page 5.5x8.5in`, `--page 148x210mm` (A5).
Named shortcuts are accepted for common cases: `letter`, `half-letter`, `a4`, `a5`, `a6`.
The default remains `letter` so v1 invocations are unchanged.
`parse_height` generalizes to a `parse_length` used for both dimensions (it already is one in all but name).

### Margins and gutter
`--gutter` sets the spine-side margin (default recommendation: `0.5in`) and `--margin` sets the other three sides (default `0.25in`).
The content box is the leaf minus these margins; the gutter is applied on the *left* of recto leaves and the *right* of verso leaves.
This mirroring is the core layout rule of this phase: a leaf does not know "left margin," it knows "spine side," and the renderer resolves which physical side that is from the leaf's recto/verso role.

### Image placement
The existing physical-height contract is preserved: `height` still means the exact printed height of the image, and width follows the aspect ratio.
The image is centered inside the content box (not the leaf), so the pair of gutter/outer margins shifts it away from the spine automatically.
If the image exceeds the content box in either dimension, the tool warns exactly as v1 does today, but measured against the content box rather than the page.
A future `--fit` mode (scale to fill the content box instead of a fixed height) is noted as out of scope; the fixed physical size is the point of this tool.

## The facing blank page

### What it is
Every image leaf gets a **companion leaf**: same leaf size, same content box, no image, but the identical formatting overlay drawn over the rectangle where the image *would* be.
The overlay rectangle on the companion leaf is placed at the mirror position across the spine.
This yields two useful physical properties: the open spread is symmetric (guides on both pages line up by eye), and if the spread is folded shut, the image and the blank guides coincide exactly — which enables tracing and transfer checks.

### Why duplex is mandatory for facing pages
In any edge-bound or folded book, the leaf facing an image is the *back of a different sheet*.
A single-sided print run therefore cannot ever put formatting opposite an image; the facing surface is always an unprinted sheet back.
So the output of this phase is a duplex-ordered PDF, and the docs state plainly: print two-sided (long-edge binding for portrait leaves), Scale 100%.
A `--no-duplex` escape hatch emits only image leaves (v1-style, one page per image, no companions) for people who just want the stack.

### Spread orientation
`--image-side {left,right}` chooses whether the image is the verso (left) or recto (right) leaf of its spread; default `left`, putting the drawing page on the right, which suits the common right-handed copy workflow.
Because spreads in a book are (page 2, page 3), (page 4, page 5), …, the leaf sequence begins with one **front-matter leaf** — a minimal title leaf (decided; content spec in `v2_spec.md`) — so that every image+companion pair lands on a single spread rather than straddling two.
The final sheet back is padded with a blank leaf when the count requires it.

## Binding modes
`--binding {stack,fold,none}` selects how leaves are imposed onto physical sheets.

### `stack` (default) — staple or stitch at the edge
Leaf size equals sheet size; each sheet carries one leaf per side.
The PDF page order is simply the reading order: front matter, then for each image its spread pair in `--image-side` order.
Printed duplex and stapled or stitched along the spine edge, this reads as a book with each image facing its formatted blank.

### `fold` — saddle-fold the whole stack
The sheet is twice the leaf width (e.g. letter sheets folded once yield half-letter leaves); the tool derives sheet size from `--page` and refuses combinations that don't correspond to a printable sheet without explicit `--sheet WxH`.
Standard booklet imposition applies: leaves are padded to a multiple of 4, and sheet *k* of *n* carries leaves `(N−2k+2, 2k−1)` on the front and `(2k, N−2k+1)` on the back, so that folding the stack in half and stapling at the fold produces correct reading order.
Imposition is a pure function `leaf sequence -> sheet layout` and lives in its own module; nothing in leaf rendering knows about it.
Padding leaves are plain blanks (no formatting), since they correspond to no image.

### `none` — v1 compatibility
One page per image, no companion leaves, no gutter mirroring (uniform margins).
This is what existing v1 invocations map to, keeping them byte-for-byte compatible in behavior.

## Formatting overlays

### Selection
`--format {crosshair,corner-x,grid,dot-grid,none}` selects the overlay; default `crosshair` (v1 behavior), and `none` makes formatting fully optional.
Exactly one overlay applies per run; combining overlays is out of scope.
All overlays are drawn as vector strokes/fills in ReportLab over the image rectangle (never rasterized), exactly like the v1 crosshair, and identically on the image leaf and its companion.

### Shared parameters
`--thickness` and `--color` keep their v1 meanings and apply to whichever overlay is selected.

### `crosshair` (existing)
Unchanged from v1: full-span by default, `--arm` for fixed arms, `--gap` for a center gap.

### `corner-x`
Two diagonal lines connecting the image rectangle's corners: top-left to bottom-right and top-right to bottom-left, forming an X spanning the full image extent (confirmed).
`--gap` is honored the same way as the crosshair: a gap of the given half-width is left empty around the center intersection.

### `grid`
A rectangular line grid clipped to the image rectangle.
`--grid-spacing` sets the cell size with unit suffix (default `0.5in`); `--grid-spacing WxH` allows non-square cells.
The grid is *center-anchored*: one horizontal and one vertical line always pass through the image center, and lines extend outward at the spacing interval, so the grid on the blank page registers with the crosshair-style center regardless of image size.
The image rectangle's own border is always stroked as the outermost grid lines, so the drawable extent is visible on the blank page.

### `dot-grid`
Dots at the intersection points of the same center-anchored lattice as `grid`.
`--dot-spacing` (default `0.25in`) sets the lattice pitch; `--dot-size` (default `0.75pt` diameter) sets the dot.
Dots are filled circles in `--color`; `--thickness` is ignored for dots.
The four corner points of the image rectangle are always included so the extent is recoverable on the blank page.

## Architecture

### Overlay abstraction
The hardcoded `CrosshairConfig` + `draw_crosshair` pair generalizes to an `Overlay` protocol: a config dataclass plus a single method `draw(pdf, rect)` where `rect` is the target rectangle in page points.
The four overlays are four small implementations; `draw_crosshair` becomes the crosshair implementation, unchanged in its math.
Because companions receive the same `rect` (mirrored placement is resolved by the layout, not the overlay), overlay code is completely ignorant of pages, spreads, and binding.

### Layer separation
The pipeline becomes four cleanly separated layers, each independently testable:

1. **Image preparation** — `prepare_image`, unchanged.
2. **Leaf construction** — pure function from (image, page geometry, overlay, options) to a pair of leaf descriptions: `(image leaf, companion leaf)`, each knowing its content rect and recto/verso role.
3. **Imposition** — pure function from a leaf sequence and binding mode to a sheet/page plan (identity for `stack`, booklet math for `fold`).
4. **Rendering** — walks the sheet plan and draws each leaf into its assigned rectangle on the canvas, using a translated coordinate state so leaf-drawing code never knows whether it occupies a whole sheet or half of one.

This is precisely the seam the folder phase needs: batch mode will produce one long leaf sequence from many images and hand it to the same imposition and rendering layers.

### Compatibility
`stack` is the default binding (decided), so a bare `crosshair image.png 4in` now produces sketchbook output: duplex-ordered pairs with gutter margins and formatted companion leaves.
Exact v1 output (one centered page per image, uniform margins, no companion) remains available via `--binding none`; all other new flags default to values that reproduce v1 behavior under that mode.

## CLI summary (new/changed flags)
```
--page WxH|name        Leaf size (default: letter)
--binding MODE         stack | fold | none (default: stack)
--sheet WxH            Physical sheet size for fold mode (default: derived)
--gutter LEN           Spine-side margin (default: 0.5in)
--margin LEN           Outer margins (default: 0.25in)
--image-side SIDE      left | right image placement in the spread (default: left)
--no-duplex            Emit image leaves only, no companion pages
--format NAME          crosshair | corner-x | grid | dot-grid | none (default: crosshair)
--grid-spacing LEN     Grid cell size (default: 0.5in)
--dot-spacing LEN      Dot lattice pitch (default: 0.25in)
--dot-size LEN         Dot diameter (default: 0.75pt)
```

## Out of scope (future phases)
- Folder-level batch construction (`v2_spec.md`) — it will consume this phase's leaf/imposition layers.
- Per-image overlay or size overrides via manifest.
- `--fit` scaling of images to the content box.
- Cut marks / registration ticks at sheet edges for trimming after binding.
- Multiple simultaneous overlays (e.g. grid + crosshair).

## Open questions / decisions to confirm
1. **Grid anchoring:** center-anchored (specified, guarantees a center registration line) vs. top-left-anchored (guarantees whole cells from the origin); center-anchored is assumed for consistency with the crosshair lineage.

(Front-matter content and the per-run duplex flip reminder were decided during the v2 revision; see `v2_spec.md`.)
