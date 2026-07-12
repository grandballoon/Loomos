"""Formatting overlays drawn over an image rectangle or its blank mirror.

Each overlay is a frozen config dataclass with a single ``draw(pdf, rect)``
method, where ``rect`` is the target ``(x, y, width, height)`` in page points.
Overlays are pure vector drawing: they know nothing about leaves, spreads, or
binding, which is what lets the same instance format an image page and its
blank companion identically.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

from reportlab.pdfgen import canvas

from .lengths import POINTS_PER_INCH

Color = tuple[float, float, float]
Rect = tuple[float, float, float, float]

# Offsets this close to a rect edge are treated as coincident with it.
_EDGE_EPSILON = 0.05


class Overlay(Protocol):
    def draw(self, pdf: canvas.Canvas, rect: Rect) -> None: ...


def _centered_offsets(half_extent: float, step: float, inclusive: bool) -> list[float]:
    """Symmetric offsets from a center at ``step`` intervals within ±half_extent.

    ``inclusive`` keeps offsets that land on the extent boundary (dot lattices
    want the edges; line grids drop them because the border is stroked anyway).
    """
    limit = half_extent + _EDGE_EPSILON if inclusive else half_extent - _EDGE_EPSILON
    offsets = [0.0]
    k = 1
    while k * step <= limit:
        offsets.extend((k * step, -k * step))
        k += 1
    return sorted(offsets)


@dataclass(frozen=True)
class CrosshairOverlay:
    """Centered crosshair; full-span by default, fixed arms otherwise."""

    thickness: float = 0.75
    color: Color = (1.0, 0.0, 0.0)
    arm_length: float = 0.5 * POINTS_PER_INCH  # Half-length of each arm (fixed mode).
    center_gap: float = 0.0                    # Half-gap left empty at the center.
    full_span: bool = True                     # Extend arms to the full rect extent.

    def draw(self, pdf: canvas.Canvas, rect: Rect) -> None:
        x, y, width, height = rect
        cx, cy = x + width / 2.0, y + height / 2.0
        h_arm = width / 2.0 if self.full_span else self.arm_length
        v_arm = height / 2.0 if self.full_span else self.arm_length

        pdf.saveState()
        pdf.setStrokeColorRGB(*self.color)
        pdf.setLineWidth(self.thickness)

        gap = self.center_gap
        if gap > 0:
            pdf.line(cx - h_arm, cy, cx - gap, cy)  # left
            pdf.line(cx + gap, cy, cx + h_arm, cy)  # right
            pdf.line(cx, cy - v_arm, cx, cy - gap)  # bottom
            pdf.line(cx, cy + gap, cx, cy + v_arm)  # top
        else:
            pdf.line(cx - h_arm, cy, cx + h_arm, cy)  # horizontal
            pdf.line(cx, cy - v_arm, cx, cy + v_arm)  # vertical

        pdf.restoreState()


@dataclass(frozen=True)
class CornerXOverlay:
    """Full corner-to-corner diagonals forming an X across the rect."""

    thickness: float = 0.75
    color: Color = (1.0, 0.0, 0.0)
    center_gap: float = 0.0  # Radius left empty around the center intersection.

    def draw(self, pdf: canvas.Canvas, rect: Rect) -> None:
        x, y, width, height = rect
        cx, cy = x + width / 2.0, y + height / 2.0

        pdf.saveState()
        pdf.setStrokeColorRGB(*self.color)
        pdf.setLineWidth(self.thickness)

        if self.center_gap > 0:
            for corner_x, corner_y in (
                (x, y), (x + width, y), (x, y + height), (x + width, y + height)
            ):
                dx, dy = corner_x - cx, corner_y - cy
                length = math.hypot(dx, dy)
                if length <= self.center_gap:
                    continue
                start_x = cx + dx / length * self.center_gap
                start_y = cy + dy / length * self.center_gap
                pdf.line(start_x, start_y, corner_x, corner_y)
        else:
            pdf.line(x, y, x + width, y + height)
            pdf.line(x, y + height, x + width, y)

        pdf.restoreState()


@dataclass(frozen=True)
class GridOverlay:
    """Center-anchored line grid clipped to the rect, border always stroked."""

    thickness: float = 0.75
    color: Color = (1.0, 0.0, 0.0)
    spacing: tuple[float, float] = (0.5 * POINTS_PER_INCH, 0.5 * POINTS_PER_INCH)

    def draw(self, pdf: canvas.Canvas, rect: Rect) -> None:
        x, y, width, height = rect
        cx, cy = x + width / 2.0, y + height / 2.0
        step_x, step_y = self.spacing

        pdf.saveState()
        pdf.setStrokeColorRGB(*self.color)
        pdf.setLineWidth(self.thickness)

        pdf.rect(x, y, width, height, stroke=1, fill=0)
        for off in _centered_offsets(width / 2.0, step_x, inclusive=False):
            pdf.line(cx + off, y, cx + off, y + height)
        for off in _centered_offsets(height / 2.0, step_y, inclusive=False):
            pdf.line(x, cy + off, x + width, cy + off)

        pdf.restoreState()


@dataclass(frozen=True)
class DotGridOverlay:
    """Dots on a center-anchored lattice; the rect's corners are always marked."""

    color: Color = (1.0, 0.0, 0.0)
    pitch: float = 0.25 * POINTS_PER_INCH
    dot_diameter: float = 0.75

    def draw(self, pdf: canvas.Canvas, rect: Rect) -> None:
        x, y, width, height = rect
        cx, cy = x + width / 2.0, y + height / 2.0
        radius = self.dot_diameter / 2.0

        pdf.saveState()
        pdf.setFillColorRGB(*self.color)

        xs = [cx + off for off in _centered_offsets(width / 2.0, self.pitch, inclusive=True)]
        ys = [cy + off for off in _centered_offsets(height / 2.0, self.pitch, inclusive=True)]
        for dot_x in xs:
            for dot_y in ys:
                pdf.circle(dot_x, dot_y, radius, stroke=0, fill=1)
        for corner_x, corner_y in (
            (x, y), (x + width, y), (x, y + height), (x + width, y + height)
        ):
            pdf.circle(corner_x, corner_y, radius, stroke=0, fill=1)

        pdf.restoreState()
