# Crosshair Print Tool — Spec (v2, revised): Folder-Level Book Construction

## Status
This spec is re-founded on the zine/sketchbook page model defined in `zine_spec.md` and is implemented together with it as a single effort.
The original v2 draft assumed v1's one-independent-page-per-image world; binding inverts that, because a stapled or folded sketchbook is inherently one document and fold-mode imposition requires the entire leaf sequence up front.
Folder mode is therefore an orchestration layer that builds one long leaf sequence from many images and hands it to the zine phase's unchanged imposition and rendering layers.
The original per-file batch behavior survives only under `--binding none`, where images really are independent.

## Purpose
Process an entire folder of images in one invocation and produce a single print-ready sketchbook: front matter, then one spread per image (image leaf plus formatted companion leaf), imposed for the chosen binding.

## Input

### Selecting a folder
The positional `image` argument accepts either a file (single-image behavior) or a directory (folder behavior), branching on `Path.is_dir()` (decided; no explicit `--batch` flag or subcommand).

### Image discovery
When the input is a directory, the tool collects files whose extension is in a fixed allowlist of raster formats Pillow can open: `.png`, `.jpg`, `.jpeg`, `.webp`, `.tif`, `.tiff`, `.bmp`, `.gif`.
Matching is case-insensitive so `.JPG` and `.jpg` are both included.
Non-image files, hidden files (names beginning with `.`), and previously generated `*.pdf` outputs are skipped so re-running over a folder never ingests its own results.
Book mode is non-recursive (decided): only the top level of the given folder is read, and producing books from nested folders means one invocation per folder; recursion remains available only in `--binding none` batch mode.
If the directory contains no matching images at the top level, the tool reports that clearly and exits non-zero.

### Ordering (decided)
Discovered images are ordered by case-insensitive natural sort of filename (`img2` before `img10`), and this order *is* the book's page order.
Renaming files is the ordering mechanism for this phase; a manifest or `--order` file for explicit sequencing is deferred (see Out of scope).

### Shared parameters
All page, binding, and formatting knobs from `zine_spec.md` — `--page`, `--binding`, `--gutter`, `--margin`, `--image-side`, `--format` and its per-format options, plus the v1 `height`, `--unit`, `--dpi`, `--thickness`, `--color` — are parsed once and applied uniformly to every image.
Per-image overrides are out of scope for this phase.

## Book assembly

### Leaf sequence
The book's leaf sequence is: the front-matter title leaf, then for each image in order its image leaf and companion leaf arranged per `--image-side`, then any padding leaves required by the binding mode (fold mode pads to a multiple of 4, padding at the back).
Leaf construction, imposition, and rendering are exactly the zine-phase layers; folder mode adds no new drawing or imposition code.

### Front matter (decided)
The front-matter leaf is a minimal title page: the folder name, the run date, and a one-line settings summary (page size, binding, format and its spacing, image height).
Its layout will be iterated on later; this phase only requires that it exist and occupy the first leaf so every image+companion pair lands on a single spread.

### Mixed orientations (decided)
`--orientation {rotate,scale}` controls what happens when an image's fixed-height width exceeds the content box; the default is `rotate`.
`rotate` turns the image 90° on its leaf when the rotated form fits better; because every image occupies exactly one leaf either way, rotation never affects pagination, spreads, or imposition.
The companion leaf's overlay rectangle mirrors the *rotated* image rectangle, preserving the fold-registration property from `zine_spec.md`.
`scale` instead shrinks the image proportionally until it fits the content box, sacrificing the exact-physical-height contract; the tool prints the effective printed size for each scaled image so the deviation is visible.
If an image fits neither as-is nor rotated and `--orientation rotate` is set, the run fails pre-flight (see Error handling) rather than silently clipping — clipping inside a bound book is never acceptable.

## Output

### One book PDF (decided)
With `--binding stack` or `--binding fold`, folder mode always produces a single book PDF.
The default output path is `<folder-name>_sketchbook.pdf` written as a sibling of the input folder; `-o` / `--output` names the file explicitly.
There is no per-file output, no `--combined` flag (it is the only behavior), and no `--skip-existing` (a book is regenerated whole).

### `--binding none` — per-file batch (v2-original behavior)
Under `--binding none`, images are independent single-page PDFs and the original batch design applies: one `<image>_crosshair.pdf` per input, `-o` naming an output directory that is created if absent, fail-soft error handling, and an optional `--recursive` walk that mirrors the source tree in the output directory.
This mode is the compatibility home for everything the book model displaced.

## Error handling (decided: abort the book)
Book mode validates before it renders: a pre-flight pass opens and prepares every discovered image, checking readability, decode success, and content-box fit under the chosen `--orientation` policy.
If any image fails pre-flight, the run reports *all* failures (path plus reason for each), writes no output, and exits non-zero — one run surfaces every problem rather than aborting at the first.
A book with silently missing pages is worse than no book, because absent images change which leaves face each other.
`--binding none` mode keeps the original fail-soft behavior — failures are logged, the rest of the batch proceeds, and a summary with a non-zero exit code reports the failures — since independent files have no pagination to corrupt.

## Printing and previewing
`--open` and `--print` act on the single book PDF exactly as in v1, including the true-scale (`print-scaling=none`) path.
The duplex reminder from `zine_spec.md` (two-sided, long-edge flip for portrait leaves, Scale 100%) is printed on every book-mode run.
In `--binding none` batch mode, `--open` and `--print` require confirmation (or `--yes`) beyond a small file-count threshold, as originally specified.

## Performance
`--jobs N` parallelizes only image preparation (decode, resample, orientation resolution) across a process pool; it feeds the pre-flight pass as well, so validation of large folders is also parallel.
Leaf assembly, imposition, and rendering are always sequential, because page order in a single document must be deterministic and the PDF canvas is a serial writer.
The default remains sequential end to end.

## Architecture notes
Folder mode adds three small units, all pure until the final render call:
discovery (`directory -> naturally sorted list of image paths`), pre-flight (`paths + options -> prepared images | aggregated failures`), and book assembly (`prepared images + options -> leaf sequence`).
The zine-phase layers (leaf construction, imposition, rendering) are consumed unchanged, which is the seam that spec deliberately built.
`main` dispatches on input type: file → single-image path (which itself produces a two-leaf mini-book under binding modes), directory → folder path.

## Compatibility
A file positional continues to work exactly as the zine phase defines it, including `--binding none` for byte-for-byte v1 output.
The displaced original-v2 flags (`--combined`, `--skip-existing`) are never introduced; `--recursive` exists only in `--binding none` mode.

## Out of scope (future)
- Recursive book construction (merged multi-folder books or one book per subfolder); deferred by decision.
- Manifest-driven ordering and per-image parameter overrides (height, format, color per file).
- Front-matter design iteration beyond the minimal title page (decided to start minimal).
- Contents-based filtering (by size, aspect ratio, metadata).
- Adaptive overlay contrast against the underlying image.
- Web scraping / Pinterest-board download and the browser-clipper capture path (tracked in `todo.md`).

## Open questions / decisions to confirm
None — all questions for this phase are decided; remaining refinements live in Out of scope.
