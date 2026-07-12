"""Command-line interface: argument parsing, validation, and mode dispatch.

Dispatch is two-dimensional: the positional input is a file or a folder, and
``--binding`` selects book output (stack/fold, one PDF) or the v1-style
per-file output (none). All drawing and imposition lives in the other modules.
"""

from __future__ import annotations

import argparse
import datetime
import subprocess
import sys
from pathlib import Path

from .batch import OUTPUT_SUFFIX, render_single_page, run_batch
from .book import build_leaf_sequence, plan_book, prepare_all, render_book
from .discovery import find_images
from .images import PRINT_DPI, prepare_image
from .leaves import RECTO, PageGeometry
from .lengths import (
    SHEET_MATCH_TOLERANCE,
    SHEET_SIZES,
    UNIT_TO_POINTS,
    format_inches,
    is_pair,
    match_sheet,
    parse_length,
    parse_page,
    parse_pair,
)
from .overlays import (
    CornerXOverlay,
    CrosshairOverlay,
    DotGridOverlay,
    GridOverlay,
    Overlay,
)

# Above this many per-file PDFs, --open/--print ask for confirmation (or --yes).
OPEN_PRINT_CONFIRM_THRESHOLD = 5

DEFAULT_COLOR = (1.0, 0.0, 0.0)


# --- CLI definition -------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Turn images into true-scale sketchbook PDFs: each image on its own "
            "page with a formatted blank facing page, imposed for binding."
        ),
    )
    parser.add_argument(
        "image", type=Path,
        help="Path to a source image, or a folder of images (book per folder).",
    )
    parser.add_argument(
        "height",
        help="Printed image height, e.g. '4in', '10cm', or a number used with --unit.",
    )
    parser.add_argument(
        "--unit", choices=sorted(set(UNIT_TO_POINTS) - {'"'}), default=None,
        help="Unit for bare numeric lengths (default: in).",
    )
    parser.add_argument(
        "-o", "--output", type=Path, default=None,
        help="Output path: a PDF file, or a directory in --binding none folder mode.",
    )
    parser.add_argument(
        "--dpi", type=int, default=PRINT_DPI,
        help=f"Resample DPI for embedded images (default: {PRINT_DPI}).",
    )

    page = parser.add_argument_group("page and binding")
    page.add_argument(
        "--page", default="letter",
        help="Leaf size: WxH (e.g. '5.5x8.5in') or letter, half-letter, a4, a5, a6.",
    )
    page.add_argument(
        "--binding", choices=("stack", "fold", "none"), default="stack",
        help="stack: duplex sheets stapled at the edge; fold: saddle-fold booklet; "
             "none: v1-style single pages (default: stack).",
    )
    page.add_argument(
        "--sheet", default=None,
        help="Fold mode: physical sheet size, WxH or a name "
             f"({', '.join(sorted(SHEET_SIZES))}); default: derived from --page.",
    )
    page.add_argument(
        "--gutter", default="0.5in", help="Spine-side margin (default: 0.5in).",
    )
    page.add_argument(
        "--margin", default="0.25in", help="Outer margins (default: 0.25in).",
    )
    page.add_argument(
        "--image-side", choices=("left", "right"), default="left",
        help="Which side of the spread the image takes (default: left).",
    )
    page.add_argument(
        "--no-duplex", action="store_true",
        help="Emit image leaves only — no companion pages, single-sided printing.",
    )
    page.add_argument(
        "--orientation", choices=("rotate", "scale"), default="rotate",
        help="When an image exceeds the content box: rotate it 90° on its leaf "
             "(default) or scale it down, sacrificing exact height.",
    )

    fmt = parser.add_argument_group("formatting overlay")
    fmt.add_argument(
        "--format", choices=("crosshair", "corner-x", "grid", "dot-grid", "none"),
        default="crosshair",
        help="Guide formatting drawn on the image and its facing page "
             "(default: crosshair).",
    )
    fmt.add_argument(
        "--thickness", type=float, default=0.75,
        help="Overlay line thickness in points (default: 0.75).",
    )
    fmt.add_argument(
        "--color", default=None,
        help="Overlay RGB color as 'r,g,b' in 0..1 (default: 1,0,0).",
    )
    fmt.add_argument(
        "--arm", default=None,
        help="Crosshair: fixed arm half-length, unit-suffixed (e.g. '0.5in'). "
             "Default: span the full image.",
    )
    fmt.add_argument(
        "--gap", default="0",
        help="Crosshair/corner-x: center gap half-width, unit-suffixed. Default: 0.",
    )
    fmt.add_argument(
        "--grid-spacing", default="0.5in",
        help="Grid cell size, a length or WxH pair (default: 0.5in).",
    )
    fmt.add_argument(
        "--dot-spacing", default="0.25in",
        help="Dot-grid lattice pitch (default: 0.25in).",
    )
    fmt.add_argument(
        "--dot-size", default="0.75pt",
        help="Dot-grid dot diameter (default: 0.75pt).",
    )

    batch = parser.add_argument_group("folder processing")
    batch.add_argument(
        "-r", "--recursive", action="store_true",
        help="Walk subdirectories (--binding none folder mode only).",
    )
    batch.add_argument(
        "--jobs", type=int, default=1,
        help="Parallel workers for image preparation (default: 1).",
    )
    batch.add_argument(
        "--yes", action="store_true",
        help="Skip the confirmation prompt when opening/printing many PDFs.",
    )

    parser.add_argument(
        "--open", action="store_true", help="Open the result in Preview."
    )
    parser.add_argument(
        "--print", dest="do_print", action="store_true",
        help="Send the result to the default printer via lp (true scale).",
    )
    return parser.parse_args(argv)


def _parse_color(spec: str) -> tuple[float, float, float]:
    parts = [float(p) for p in spec.split(",")]
    if len(parts) != 3 or not all(0.0 <= p <= 1.0 for p in parts):
        raise ValueError("Color must be three values 'r,g,b' in 0..1")
    return parts[0], parts[1], parts[2]


def build_overlay(args: argparse.Namespace) -> Overlay | None:
    if args.format == "none":
        return None
    color = _parse_color(args.color) if args.color else DEFAULT_COLOR
    gap = parse_length(args.gap, args.unit) if args.gap and args.gap != "0" else 0.0

    if args.format == "crosshair":
        return CrosshairOverlay(
            thickness=args.thickness,
            color=color,
            arm_length=(
                parse_length(args.arm, args.unit)
                if args.arm
                else CrosshairOverlay.arm_length
            ),
            center_gap=gap,
            full_span=args.arm is None,
        )
    if args.format == "corner-x":
        return CornerXOverlay(thickness=args.thickness, color=color, center_gap=gap)
    if args.format == "grid":
        if is_pair(args.grid_spacing):
            spacing = parse_pair(args.grid_spacing, args.unit)
        else:
            step = parse_length(args.grid_spacing, args.unit)
            spacing = (step, step)
        return GridOverlay(thickness=args.thickness, color=color, spacing=spacing)
    return DotGridOverlay(
        color=color,
        pitch=parse_length(args.dot_spacing, args.unit),
        dot_diameter=parse_length(args.dot_size, args.unit),
    )


# --- macOS printing ---------------------------------------------------------------


def open_in_preview(pdf_path: Path) -> None:
    """Open the PDF in Preview. Print with 'Scale: 100%' / actual size."""
    subprocess.run(["open", "-a", "Preview", str(pdf_path)], check=True)


def print_pdf(pdf_path: Path) -> None:
    """Send the PDF to the default printer at true scale (no auto-scaling)."""
    # print-scaling=none disables CUPS auto-fit so physical size is preserved.
    subprocess.run(["lp", "-o", "print-scaling=none", str(pdf_path)], check=True)


def _open_or_print_one(args: argparse.Namespace, pdf_path: Path) -> None:
    if args.open:
        open_in_preview(pdf_path)
        print(
            "Opened in Preview. In the print dialog, choose Scale 100% / actual "
            "size — never 'Fit to Page'.",
            file=sys.stderr,
        )
    if args.do_print:
        print_pdf(pdf_path)


def _open_or_print_many(args: argparse.Namespace, outputs: list[Path]) -> None:
    if not (args.open or args.do_print) or not outputs:
        return
    if len(outputs) > OPEN_PRINT_CONFIRM_THRESHOLD and not args.yes:
        action = "Open" if args.open else "Print"
        try:
            answer = input(f"{action} {len(outputs)} PDFs? [y/N] ")
        except EOFError:
            answer = ""
        if answer.strip().lower() not in ("y", "yes"):
            print("Skipped opening/printing; use --yes to bypass.", file=sys.stderr)
            return
    for output in outputs:
        _open_or_print_one(args, output)


# --- book mode helpers --------------------------------------------------------------


def resolve_sheet(
    sheet_arg: str | None, leaf_w: float, leaf_h: float, unit: str | None
) -> tuple[float, float]:
    """Physical sheet for fold mode: explicit, or derived from the leaf and
    snapped to a standard printable size."""
    tolerance = SHEET_MATCH_TOLERANCE
    if sheet_arg:
        key = sheet_arg.strip().lower()
        if key in SHEET_SIZES:
            sheet_w, sheet_h = SHEET_SIZES[key]
            if not (2 * leaf_w <= sheet_w + tolerance and leaf_h <= sheet_h + tolerance):
                sheet_w, sheet_h = sheet_h, sheet_w  # try the other orientation
        else:
            sheet_w, sheet_h = parse_pair(sheet_arg, unit)
        if 2 * leaf_w > sheet_w + tolerance or leaf_h > sheet_h + tolerance:
            raise ValueError(
                f"sheet {format_inches(sheet_w)} x {format_inches(sheet_h)} cannot "
                f"carry two {format_inches(leaf_w)} x {format_inches(leaf_h)} "
                "leaves side by side"
            )
        return sheet_w, sheet_h

    derived_w, derived_h = 2 * leaf_w, leaf_h
    matched = match_sheet(derived_w, derived_h)
    if matched is None:
        raise ValueError(
            f"two {format_inches(leaf_w)} x {format_inches(leaf_h)} leaves need a "
            f"{format_inches(derived_w)} x {format_inches(derived_h)} sheet, which "
            "matches no standard size; pass --sheet WxH explicitly"
        )
    return matched[1]


def _settings_summary(
    args: argparse.Namespace, page_size: tuple[float, float], height_pt: float
) -> str:
    fmt = args.format
    if fmt == "grid":
        fmt = f"grid {args.grid_spacing}"
    elif fmt == "dot-grid":
        fmt = f"dot-grid {args.dot_spacing}"
    return " · ".join(
        (
            f"{format_inches(page_size[0])} x {format_inches(page_size[1])}",
            args.binding,
            fmt,
            f"image height {format_inches(height_pt)}",
        )
    )


def _duplex_reminder(binding: str, page_size: tuple[float, float]) -> None:
    flip = "long" if page_size[1] >= page_size[0] else "short"
    message = (
        f"Print two-sided, flip on the {flip} edge, Scale 100% / actual size."
    )
    if binding == "fold":
        message += " Then fold the stack in half and staple along the fold."
    else:
        message += " Then staple or stitch along the spine edge."
    print(message, file=sys.stderr)


# --- mode runners ---------------------------------------------------------------


def _run_none_mode(
    args: argparse.Namespace,
    page_size: tuple[float, float],
    overlay: Overlay | None,
    target_height_pt: float,
) -> int:
    if args.image.is_dir():
        paths = find_images(args.image, recursive=args.recursive)
        if not paths:
            print(f"Error: no images found in {args.image}", file=sys.stderr)
            return 1
        outputs, failures = run_batch(
            paths, args.image, args.output, page_size, overlay,
            target_height_pt, args.dpi,
        )
        _open_or_print_many(args, outputs)
        return 1 if failures else 0

    try:
        prepared = prepare_image(args.image, target_height_pt, args.dpi)
    except Exception as exc:
        print(f"Error: {args.image}: {exc}", file=sys.stderr)
        return 1
    output = args.output or args.image.with_name(args.image.stem + OUTPUT_SUFFIX)
    render_single_page(prepared, page_size, overlay, output)
    print(f"Wrote {output}")
    _open_or_print_one(args, output)
    return 0


def _run_book_mode(
    args: argparse.Namespace,
    page_size: tuple[float, float],
    overlay: Overlay | None,
    target_height_pt: float,
    gutter: float,
    margin: float,
    duplex: bool,
) -> int:
    geometry = PageGeometry(*page_size, gutter=gutter, margin=margin)
    _, _, box_w, box_h = geometry.content_box(RECTO)
    if box_w <= 0 or box_h <= 0:
        print("Error: gutter and margin leave no room on the page", file=sys.stderr)
        return 1

    sheet_size = None
    if args.binding == "fold":
        try:
            sheet_size = resolve_sheet(args.sheet, *page_size, args.unit)
        except ValueError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1

    if args.image.is_dir():
        paths = find_images(args.image, recursive=False)
        if not paths:
            print(
                f"Error: no images found at the top level of {args.image}",
                file=sys.stderr,
            )
            return 1
        title = args.image.name
        default_output = args.image.parent / f"{args.image.name}_sketchbook.pdf"
    else:
        paths = [args.image]
        title = args.image.stem
        default_output = args.image.with_name(f"{args.image.stem}_sketchbook.pdf")

    prepared, failures = prepare_all(
        paths, target_height_pt, args.dpi, (box_w, box_h), args.orientation, args.jobs
    )
    if failures:
        print(
            f"Error: {len(failures)} of {len(paths)} image(s) failed pre-flight; "
            "no output written.",
            file=sys.stderr,
        )
        for path, reason in failures:
            print(f"  {path}: {reason}", file=sys.stderr)
        return 1

    for image in prepared:
        if image.rotated:
            print(
                f"Note: {image.source.name} rotated 90° to fit its page.",
                file=sys.stderr,
            )
        if image.scale < 1.0:
            print(
                f"Note: {image.source.name} scaled to {format_inches(image.width_pt)}"
                f" x {format_inches(image.height_pt)} ({image.scale:.0%}) to fit.",
                file=sys.stderr,
            )

    title_lines = (
        title,
        datetime.date.today().isoformat(),
        _settings_summary(args, page_size, target_height_pt),
    )
    leaves = build_leaf_sequence(
        prepared, overlay, args.image_side, duplex, title_lines, args.binding
    )
    plan = plan_book(leaves, args.binding, geometry, sheet_size)

    output = args.output or default_output
    render_book(leaves, plan, geometry, output)
    print(f"Wrote {output} ({len(leaves)} leaves on {len(plan.pages)} PDF pages)")
    if duplex:
        _duplex_reminder(args.binding, plan.page_size)
    _open_or_print_one(args, output)
    return 0


# --- entry point ----------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if not args.image.exists():
        print(f"Error: input not found: {args.image}", file=sys.stderr)
        return 1
    if args.binding == "fold" and args.no_duplex:
        print("Error: fold binding requires duplex printing", file=sys.stderr)
        return 1
    if args.recursive and args.binding != "none":
        print(
            "Error: --recursive applies only to --binding none; book mode reads "
            "one folder per invocation",
            file=sys.stderr,
        )
        return 1
    if args.sheet and args.binding != "fold":
        print("Error: --sheet applies only to --binding fold", file=sys.stderr)
        return 1

    try:
        target_height_pt = parse_length(args.height, args.unit)
        page_size = parse_page(args.page, args.unit)
        gutter = parse_length(args.gutter, args.unit)
        margin = parse_length(args.margin, args.unit)
        overlay = build_overlay(args)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.binding == "none":
        return _run_none_mode(args, page_size, overlay, target_height_pt)
    return _run_book_mode(
        args, page_size, overlay, target_height_pt, gutter, margin,
        duplex=not args.no_duplex,
    )
