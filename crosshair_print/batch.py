"""Per-file mode (``--binding none``): independent single-page PDFs.

This is the v1 output model: each image becomes its own page-centered PDF with
the selected overlay. Batch runs over a folder are fail-soft — one bad image is
logged and skipped, because independent files have no pagination to corrupt.
"""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .images import PreparedImage, prepare_image
from .lengths import format_inches
from .overlays import Overlay

OUTPUT_SUFFIX = "_crosshair.pdf"


def render_single_page(
    prepared: PreparedImage,
    page_size: tuple[float, float],
    overlay: Overlay | None,
    output_path: Path,
) -> Path:
    """Compose one PDF page: image centered on the page, overlay on the image."""
    page_w, page_h = page_size
    width, height = prepared.width_pt, prepared.height_pt
    if width > page_w or height > page_h:
        print(
            f"Warning: image ({format_inches(width)} x {format_inches(height)}) "
            f"exceeds the page and will be clipped when printed at actual size.",
            file=sys.stderr,
        )
    x = (page_w - width) / 2.0
    y = (page_h - height) / 2.0

    pdf = canvas.Canvas(str(output_path), pagesize=page_size)
    pdf.drawImage(
        ImageReader(prepared.image), x, y, width=width, height=height,
        preserveAspectRatio=False, mask=None,
    )
    if overlay is not None:
        overlay.draw(pdf, (x, y, width, height))
    pdf.showPage()
    pdf.save()
    return output_path


def output_path_for(source: Path, root: Path | None, output_dir: Path | None) -> Path:
    """Destination for one source image.

    With an output directory, results go there — mirroring the source subtree
    when a discovery root is given (recursive runs) so names cannot collide.
    Otherwise the PDF lands next to its source, v1-style.
    """
    name = source.stem + OUTPUT_SUFFIX
    if output_dir is None:
        return source.with_name(name)
    if root is not None:
        return output_dir / source.relative_to(root).parent / name
    return output_dir / name


def run_batch(
    paths: list[Path],
    root: Path,
    output_dir: Path | None,
    page_size: tuple[float, float],
    overlay: Overlay | None,
    target_height_pt: float,
    dpi: int,
) -> tuple[list[Path], list[tuple[Path, str]]]:
    """Process a folder fail-soft; returns (written outputs, failures)."""
    outputs: list[Path] = []
    failures: list[tuple[Path, str]] = []

    for path in paths:
        destination = output_path_for(path, root, output_dir)
        try:
            prepared = prepare_image(path, target_height_pt, dpi)
            destination.parent.mkdir(parents=True, exist_ok=True)
            outputs.append(
                render_single_page(prepared, page_size, overlay, destination)
            )
        except Exception as exc:
            failures.append((path, str(exc)))
            print(f"Error: {path}: {exc}", file=sys.stderr)

    print(
        f"Processed {len(outputs)} of {len(paths)} image(s); "
        f"{len(failures)} failed.",
        file=sys.stderr,
    )
    for path, _reason in failures:
        print(f"  failed: {path}", file=sys.stderr)
    return outputs, failures
