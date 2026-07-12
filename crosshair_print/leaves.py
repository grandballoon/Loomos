"""Leaf model: one logical book page, its geometry, and its drawing.

A leaf never knows how it reaches paper — whether it fills a sheet (stack) or
shares one (fold) is the imposition layer's business. Drawing assumes the
canvas origin is already translated to the leaf's bottom-left corner.
"""

from __future__ import annotations

from dataclasses import dataclass

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .images import PreparedImage
from .overlays import Overlay, Rect

RECTO = "recto"  # Right-hand page of an open spread; spine on its left.
VERSO = "verso"  # Left-hand page; spine on its right.

_TITLE_STYLES = (("Helvetica-Bold", 16.0), ("Helvetica", 10.0), ("Helvetica", 8.0))


@dataclass(frozen=True)
class PageGeometry:
    """Leaf size and margins; the gutter hugs whichever side the spine is on."""

    width: float
    height: float
    gutter: float = 0.0
    margin: float = 0.0

    def content_box(self, role: str) -> Rect:
        left = self.gutter if role == RECTO else self.margin
        right = self.margin if role == RECTO else self.gutter
        return (
            left,
            self.margin,
            self.width - left - right,
            self.height - 2 * self.margin,
        )


@dataclass
class Leaf:
    """One book page: an image, its formatted companion, a title, or a blank.

    ``content_size`` is the overlay rectangle's dimensions — the image's printed
    size, which the companion shares so its guides mirror the image exactly.
    """

    kind: str  # "image" | "companion" | "title" | "blank"
    role: str = RECTO
    image: PreparedImage | None = None
    content_size: tuple[float, float] | None = None
    overlay: Overlay | None = None
    title_lines: tuple[str, ...] = ()


def content_rect(leaf: Leaf, geometry: PageGeometry) -> Rect:
    """The image/overlay rectangle: ``content_size`` centered in the content box.

    Because recto and verso content boxes mirror each other across the spine and
    the rect is centered in its box, an image leaf's rect and its companion's
    rect are automatically mirror images across the spine.
    """
    box_x, box_y, box_w, box_h = geometry.content_box(leaf.role)
    width, height = leaf.content_size
    return (box_x + (box_w - width) / 2.0, box_y + (box_h - height) / 2.0, width, height)


def draw_leaf(pdf: canvas.Canvas, leaf: Leaf, geometry: PageGeometry) -> None:
    """Draw one leaf with its origin at the current canvas origin."""
    if leaf.kind == "blank":
        return
    if leaf.kind == "title":
        _draw_title(pdf, leaf, geometry)
        return

    x, y, width, height = content_rect(leaf, geometry)
    if leaf.image is not None:
        pdf.drawImage(
            ImageReader(leaf.image.image), x, y, width=width, height=height,
            preserveAspectRatio=False, mask=None,
        )
    if leaf.overlay is not None:
        leaf.overlay.draw(pdf, (x, y, width, height))


def _draw_title(pdf: canvas.Canvas, leaf: Leaf, geometry: PageGeometry) -> None:
    box_x, box_y, box_w, box_h = geometry.content_box(leaf.role)
    center_x = box_x + box_w / 2.0
    baseline = box_y + box_h * 0.62

    pdf.saveState()
    pdf.setFillColorRGB(0.0, 0.0, 0.0)
    for index, text in enumerate(leaf.title_lines):
        font, size = _TITLE_STYLES[min(index, len(_TITLE_STYLES) - 1)]
        pdf.setFont(font, size)
        pdf.drawCentredString(center_x, baseline, text)
        baseline -= size * 2.2
    pdf.restoreState()
