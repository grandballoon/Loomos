"""Book assembly: pre-flight preparation, leaf sequencing, and rendering.

A book is one PDF: a title leaf, then per image an image leaf and its formatted
companion arranged so each pair shares a spread, then padding blanks as the
binding requires. Pre-flight prepares (and thereby validates) every image
before anything is rendered, so a failure aborts with nothing written.
"""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from reportlab.pdfgen import canvas

from .images import PreparedImage, prepare_image
from .imposition import PagePlan, fold_plan, padding_needed, stack_plan
from .leaves import RECTO, VERSO, Leaf, PageGeometry, draw_leaf
from .overlays import Overlay


def _role_for_index(index: int) -> str:
    """Reading-order role: PDF page 1 (index 0) is a recto, and they alternate."""
    return RECTO if index % 2 == 0 else VERSO


def prepare_all(
    paths: list[Path],
    target_height_pt: float,
    dpi: int,
    fit_box: tuple[float, float] | None,
    orientation: str,
    jobs: int = 1,
) -> tuple[list[PreparedImage], list[tuple[Path, str]]]:
    """Prepare every image, collecting failures instead of raising.

    Returns prepared images in input order plus ``(path, reason)`` failures.
    With ``jobs > 1`` preparation fans out across a process pool; results are
    reassembled into input order so parallelism never reorders the book.
    """
    results: dict[Path, PreparedImage] = {}
    failures: list[tuple[Path, str]] = []

    if jobs <= 1:
        for path in paths:
            try:
                results[path] = prepare_image(
                    path, target_height_pt, dpi, fit_box, orientation
                )
            except Exception as exc:
                failures.append((path, str(exc)))
    else:
        with ProcessPoolExecutor(max_workers=jobs) as executor:
            futures = {
                executor.submit(
                    prepare_image, path, target_height_pt, dpi, fit_box, orientation
                ): path
                for path in paths
            }
            for future in as_completed(futures):
                path = futures[future]
                try:
                    results[path] = future.result()
                except Exception as exc:
                    failures.append((path, str(exc)))

    prepared = [results[path] for path in paths if path in results]
    failures.sort(key=lambda item: paths.index(item[0]))
    return prepared, failures


def build_leaf_sequence(
    images: list[PreparedImage],
    overlay: Overlay | None,
    image_side: str,
    duplex: bool,
    title_lines: tuple[str, ...],
    binding: str,
) -> list[Leaf]:
    """Assemble the reading-order leaf sequence, padded for the binding.

    Duplex books open with a title leaf so every image+companion pair lands on
    one spread; ``image_side`` picks which side of the spread the image takes.
    Without duplex there are only image leaves, all rectos (single-sided stack).
    """
    leaves: list[Leaf] = []

    def add(leaf: Leaf) -> None:
        leaf.role = _role_for_index(len(leaves)) if duplex else RECTO
        leaves.append(leaf)

    if duplex:
        add(Leaf("title", title_lines=title_lines))
    for prepared in images:
        size = (prepared.width_pt, prepared.height_pt)
        image_leaf = Leaf("image", image=prepared, content_size=size, overlay=overlay)
        if not duplex:
            add(image_leaf)
            continue
        companion = Leaf("companion", content_size=size, overlay=overlay)
        # The verso slot of the spread is filled first (spreads are verso, recto).
        if image_side == "left":
            add(image_leaf)
            add(companion)
        else:
            add(companion)
            add(image_leaf)

    for _ in range(padding_needed(len(leaves), binding, duplex)):
        add(Leaf("blank"))
    return leaves


def plan_book(
    leaves: list[Leaf],
    binding: str,
    geometry: PageGeometry,
    sheet_size: tuple[float, float] | None,
) -> PagePlan:
    leaf_size = (geometry.width, geometry.height)
    if binding == "fold":
        return fold_plan(len(leaves), leaf_size, sheet_size)
    return stack_plan(len(leaves), leaf_size)


def render_book(
    leaves: list[Leaf],
    plan: PagePlan,
    geometry: PageGeometry,
    output_path: Path,
) -> Path:
    pdf = canvas.Canvas(str(output_path), pagesize=plan.page_size)
    for page in plan.pages:
        for leaf_index, offset_x, offset_y in page:
            pdf.saveState()
            pdf.translate(offset_x, offset_y)
            draw_leaf(pdf, leaves[leaf_index], geometry)
            pdf.restoreState()
        pdf.showPage()
    pdf.save()
    return output_path
