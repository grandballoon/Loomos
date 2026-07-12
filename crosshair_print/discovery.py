"""Folder image discovery and ordering.

Discovery order is the book's page order, so sorting is natural (numeric-aware)
and case-insensitive: ``img2`` comes before ``img10``.
"""

from __future__ import annotations

import re
from pathlib import Path

# Raster formats Pillow can open; anything else (including generated PDFs) is skipped.
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".gif"}

_DIGITS_RE = re.compile(r"(\d+)")


def natural_key(text: str) -> tuple:
    """Case-insensitive sort key that orders embedded numbers numerically."""
    return tuple(
        (0, int(token)) if token.isdigit() else (1, token)
        for token in _DIGITS_RE.split(text.lower())
    )


def find_images(directory: Path, recursive: bool = False) -> list[Path]:
    """Discover image files under a directory, naturally sorted.

    Hidden files and files inside hidden directories are skipped, as are
    non-image extensions (which excludes previously generated PDFs).
    """
    candidates = directory.rglob("*") if recursive else directory.iterdir()
    found = []
    for path in candidates:
        if not path.is_file():
            continue
        relative = path.relative_to(directory)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        found.append(path)

    found.sort(
        key=lambda p: tuple(natural_key(part) for part in p.relative_to(directory).parts)
    )
    return found
