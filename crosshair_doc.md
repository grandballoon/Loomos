# crosshair — command reference

Turn images into true-scale sketchbook PDFs.
Each image is placed on its own page at an exact physical height, with a blank facing page carrying the same guide formatting, imposed for stapling (`stack`) or saddle-folding (`fold`) into a paper sketchbook.
`--binding none` reproduces the original v1 behavior: one centered page per image, no companion.

Specs: `zine_spec.md` (page model, overlays, binding) and `v2_spec.md` (folder-level book construction).

## Common invocations

```sh
crosshair photo.png 4in                      # one-image sketchbook (letter, stack)
crosshair ./photos 3in                       # folder -> photos_sketchbook.pdf
crosshair ./photos 2in --binding fold --page half-letter   # saddle-fold booklet on letter sheets
crosshair ./photos 3in --format grid --grid-spacing 0.5in  # grid guides instead of crosshair
crosshair photo.png 4in --binding none       # v1 behavior: single centered page
```

Always print at Scale 100% / actual size; book output states the duplex flip setting to use.

## Help output

```
usage: crosshair [-h] [--unit {cm,in,inch,inches,mm,pt}] [-o OUTPUT]
                 [--dpi DPI] [--page PAGE] [--binding {stack,fold,none}]
                 [--sheet SHEET] [--gutter GUTTER] [--margin MARGIN]
                 [--image-side {left,right}] [--no-duplex]
                 [--orientation {rotate,scale}]
                 [--format {crosshair,corner-x,grid,dot-grid,none}]
                 [--thickness THICKNESS] [--color COLOR] [--arm ARM]
                 [--gap GAP] [--grid-spacing GRID_SPACING]
                 [--dot-spacing DOT_SPACING] [--dot-size DOT_SIZE] [-r]
                 [--jobs JOBS] [--yes] [--open] [--print]
                 image height

Turn images into true-scale sketchbook PDFs: each image on its own page with a
formatted blank facing page, imposed for binding.

positional arguments:
  image                 Path to a source image, or a folder of images (book
                        per folder).
  height                Printed image height, e.g. '4in', '10cm', or a number
                        used with --unit.

options:
  -h, --help            show this help message and exit
  --unit {cm,in,inch,inches,mm,pt}
                        Unit for bare numeric lengths (default: in).
  -o OUTPUT, --output OUTPUT
                        Output path: a PDF file, or a directory in --binding
                        none folder mode.
  --dpi DPI             Resample DPI for embedded images (default: 300).
  --open                Open the result in Preview.
  --print               Send the result to the default printer via lp (true
                        scale).

page and binding:
  --page PAGE           Leaf size: WxH (e.g. '5.5x8.5in') or letter, half-
                        letter, a4, a5, a6.
  --binding {stack,fold,none}
                        stack: duplex sheets stapled at the edge; fold:
                        saddle-fold booklet; none: v1-style single pages
                        (default: stack).
  --sheet SHEET         Fold mode: physical sheet size, WxH or a name (a3, a4,
                        a5, legal, letter, tabloid); default: derived from
                        --page.
  --gutter GUTTER       Spine-side margin (default: 0.5in).
  --margin MARGIN       Outer margins (default: 0.25in).
  --image-side {left,right}
                        Which side of the spread the image takes (default:
                        left).
  --no-duplex           Emit image leaves only — no companion pages, single-
                        sided printing.
  --orientation {rotate,scale}
                        When an image exceeds the content box: rotate it 90°
                        on its leaf (default) or scale it down, sacrificing
                        exact height.

formatting overlay:
  --format {crosshair,corner-x,grid,dot-grid,none}
                        Guide formatting drawn on the image and its facing
                        page (default: crosshair).
  --thickness THICKNESS
                        Overlay line thickness in points (default: 0.75).
  --color COLOR         Overlay RGB color as 'r,g,b' in 0..1 (default: 1,0,0).
  --arm ARM             Crosshair: fixed arm half-length, unit-suffixed (e.g.
                        '0.5in'). Default: span the full image.
  --gap GAP             Crosshair/corner-x: center gap half-width, unit-
                        suffixed. Default: 0.
  --grid-spacing GRID_SPACING
                        Grid cell size, a length or WxH pair (default: 0.5in).
  --dot-spacing DOT_SPACING
                        Dot-grid lattice pitch (default: 0.25in).
  --dot-size DOT_SIZE   Dot-grid dot diameter (default: 0.75pt).

folder processing:
  -r, --recursive       Walk subdirectories (--binding none folder mode only).
  --jobs JOBS           Parallel workers for image preparation (default: 1).
  --yes                 Skip the confirmation prompt when opening/printing
                        many PDFs.
```
