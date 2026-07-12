"""Physical length, pair, and page-size parsing.

Every dimension in the tool is a float in PostScript points (72 pt/in); this
module is the single place where user-facing unit strings become points.
"""

from __future__ import annotations

import re

POINTS_PER_INCH = 72.0

# Physical-unit suffixes accepted in a length value, mapped to points-per-unit.
UNIT_TO_POINTS = {
    "in": POINTS_PER_INCH,
    "inch": POINTS_PER_INCH,
    "inches": POINTS_PER_INCH,
    '"': POINTS_PER_INCH,
    "cm": POINTS_PER_INCH / 2.54,
    "mm": POINTS_PER_INCH / 25.4,
    "pt": 1.0,
}
DEFAULT_UNIT = "in"

_LENGTH_RE = re.compile(r"\s*([0-9]*\.?[0-9]+)\s*([a-zA-Z\"]*)\s*")
_PAIR_SPLIT_RE = re.compile(r"\s*[x×]\s*")

# Named leaf sizes, portrait orientation, in points.
PAGE_SIZES: dict[str, tuple[float, float]] = {
    "letter": (612.0, 792.0),
    "half-letter": (396.0, 612.0),
    "a4": (595.2756, 841.8898),
    "a5": (419.5276, 595.2756),
    "a6": (297.6378, 419.5276),
}

# Printable sheet sizes a derived fold-mode sheet may snap to, portrait, in points.
SHEET_SIZES: dict[str, tuple[float, float]] = {
    "letter": (612.0, 792.0),
    "legal": (612.0, 1008.0),
    "tabloid": (792.0, 1224.0),
    "a3": (841.8898, 1190.5512),
    "a4": (595.2756, 841.8898),
    "a5": (419.5276, 595.2756),
}

# How far a derived sheet may differ from a known size and still snap to it (~3 mm).
SHEET_MATCH_TOLERANCE = 9.0


def parse_length(value: str, unit: str | None = None) -> float:
    """Convert a length spec to points.

    Accepts a unit-suffixed value (``"4in"``, ``"10 cm"``, ``'3.5"'``, ``"2pt"``)
    or a bare number paired with ``unit``. A suffix on the value takes precedence
    over ``unit``; if neither is present, ``DEFAULT_UNIT`` is assumed.
    """
    match = _LENGTH_RE.fullmatch(value)
    if not match:
        raise ValueError(f"Cannot parse length {value!r}")
    magnitude = float(match.group(1))
    suffix = match.group(2).lower()

    resolved_unit = suffix or (unit.lower() if unit else DEFAULT_UNIT)
    if resolved_unit not in UNIT_TO_POINTS:
        raise ValueError(
            f"Unknown unit {resolved_unit!r}; use one of {', '.join(sorted(UNIT_TO_POINTS))}"
        )
    if magnitude <= 0:
        raise ValueError("Length must be positive")
    return magnitude * UNIT_TO_POINTS[resolved_unit]


def is_pair(value: str) -> bool:
    """True if the value looks like a WxH pair rather than a single length."""
    return re.search(r"[0-9\"]\s*[x×]", value) is not None


def parse_pair(value: str, unit: str | None = None) -> tuple[float, float]:
    """Convert a ``WxH`` spec to a (width, height) pair in points.

    A unit suffix on the second component applies to both when the first has
    none, so ``"5.5x8.5in"`` and ``"148x210mm"`` work as expected.
    """
    parts = _PAIR_SPLIT_RE.split(value.strip(), maxsplit=1)
    if len(parts) != 2:
        raise ValueError(f"Cannot parse pair {value!r}; expected 'WxH'")
    w_str, h_str = parts

    h_match = _LENGTH_RE.fullmatch(h_str)
    shared_unit = (h_match.group(2) if h_match and h_match.group(2) else None) or unit
    return parse_length(w_str, shared_unit), parse_length(h_str, unit)


def parse_page(value: str, unit: str | None = None) -> tuple[float, float]:
    """Resolve a page spec — a named size or a ``WxH`` pair — to points."""
    key = value.strip().lower()
    if key in PAGE_SIZES:
        return PAGE_SIZES[key]
    if is_pair(value):
        return parse_pair(value, unit)
    raise ValueError(
        f"Unknown page {value!r}; use WxH (e.g. '5.5x8.5in') or one of "
        f"{', '.join(sorted(PAGE_SIZES))}"
    )


def match_sheet(width: float, height: float) -> tuple[str, tuple[float, float]] | None:
    """Snap a derived sheet size to a known printable sheet, in either orientation.

    Returns ``(name, (w, h))`` with the known size oriented like the input, or
    ``None`` when nothing matches within ``SHEET_MATCH_TOLERANCE``.
    """
    for name, (sw, sh) in SHEET_SIZES.items():
        for cand_w, cand_h in ((sw, sh), (sh, sw)):
            if (
                abs(cand_w - width) <= SHEET_MATCH_TOLERANCE
                and abs(cand_h - height) <= SHEET_MATCH_TOLERANCE
            ):
                return name, (cand_w, cand_h)
    return None


def format_inches(points: float) -> str:
    """Human-readable inches for messages, e.g. ``'4.25 in'``."""
    text = f"{points / POINTS_PER_INCH:.2f}".rstrip("0").rstrip(".")
    return f"{text} in"
