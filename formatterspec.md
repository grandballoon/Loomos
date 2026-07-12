# Crosshair Print Tool — Spec (v1)

## Purpose
Resize an image to a specified physical height, overlay a centered crosshair, and output a print-accurate letter-size PDF for true-scale printing on macOS.

## Input
- Single image path (arg).
- Target height: any value, specified in inches or centimeters (arg + unit flag, or unit-suffixed value); converted internally to a common unit.
- Config constants: crosshair thickness, color, arm length, and optional center gap.

## Processing
1. Open image (Pillow), resize to target height preserving aspect ratio.
2. Compute center; derive width from aspect ratio.

## Crosshair
- Draw horizontal + vertical lines through center, vector-rendered in ReportLab for crisp output (not rasterized into the image).
- Thickness, color, arm length, and center gap set by config.

## Output (ReportLab)
- Letter-size canvas (8.5×11) at 72 pt/inch.
- Convert target height to points; compute width from aspect ratio.
- Center image on page; `drawImage` at exact point dimensions so DPI doesn't distort physical size.
- Overlay crosshair as vector lines at page center.
- Save PDF.

## Printing (macOS)
- Open in Preview and print at 100% / actual size (not "fit to page"), or `lp file.pdf` via subprocess.
- Must avoid any auto-scaling.

## Architecture notes
- Structure core steps (resize, layout, crosshair, output) as discrete functions to allow batch processing over a folder in a later iteration.

## Out of scope (future)
- **v2:** Crosshair color/contrast adapts to underlying image (brightness, mottling) for visibility over bright/dark/busy regions.
- Batch folder processing.