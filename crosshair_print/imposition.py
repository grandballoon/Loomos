"""Impose a leaf sequence onto physical PDF pages for a binding mode.

Pure math: given leaf count and sizes, produce a plan of pages, each a tuple of
``(leaf_index, x_offset, y_offset)`` placements. Rendering walks the plan and
draws each referenced leaf at its offset; nothing here draws anything.
"""

from __future__ import annotations

from dataclasses import dataclass

Placement = tuple[int, float, float]  # (leaf index, x offset, y offset)


@dataclass(frozen=True)
class PagePlan:
    page_size: tuple[float, float]
    pages: tuple[tuple[Placement, ...], ...]


def padding_needed(leaf_count: int, binding: str, duplex: bool) -> int:
    """Blank leaves to append so the count fills whole printed sheets."""
    if not duplex:
        return 0
    if binding == "fold":
        return -leaf_count % 4
    return leaf_count % 2  # stack: duplex sheets carry two leaves


def stack_plan(leaf_count: int, leaf_size: tuple[float, float]) -> PagePlan:
    """One leaf per PDF page, in reading order; duplex printing pairs them."""
    pages = tuple(((index, 0.0, 0.0),) for index in range(leaf_count))
    return PagePlan(leaf_size, pages)


def fold_plan(
    leaf_count: int,
    leaf_size: tuple[float, float],
    sheet_size: tuple[float, float],
) -> PagePlan:
    """Saddle-fold booklet imposition: two leaves per sheet side.

    For N leaves (a multiple of 4), sheet k carries leaves (N-2k+2, 2k-1) on its
    front and (2k, N-2k+1) on its back, so folding the printed stack in half
    yields correct reading order. Pages alternate front, back, front, back so
    the PDF prints directly on a duplex printer (short-edge flip).
    """
    if leaf_count % 4 != 0:
        raise ValueError(f"Fold imposition needs a multiple of 4 leaves, got {leaf_count}")
    leaf_w, leaf_h = leaf_size
    sheet_w, sheet_h = sheet_size

    x_left = (sheet_w - 2 * leaf_w) / 2.0
    x_right = x_left + leaf_w
    y = (sheet_h - leaf_h) / 2.0

    pages: list[tuple[Placement, ...]] = []
    for k in range(1, leaf_count // 4 + 1):
        pages.append(
            ((leaf_count - 2 * k + 1, x_left, y), (2 * k - 2, x_right, y))  # front
        )
        pages.append(
            ((2 * k - 1, x_left, y), (leaf_count - 2 * k, x_right, y))  # back
        )
    return PagePlan(sheet_size, tuple(pages))
