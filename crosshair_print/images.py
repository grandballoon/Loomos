"""Image loading, physical sizing, and orientation fitting.

The physical contract is v1's: the target height fixes the printed height, and
width follows the source aspect ratio. Book modes additionally fit the image to
the leaf's content box under an orientation policy (rotate or scale); rotation
never changes how many leaves an image occupies, so it cannot affect pagination.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from .lengths import POINTS_PER_INCH, format_inches

PRINT_DPI = 300  # Pixel density used when resampling the embedded image.


class FitError(ValueError):
    """The image cannot be placed on the leaf under the orientation policy."""


@dataclass
class PreparedImage:
    """A resampled RGB image with its final printed dimensions in points."""

    source: Path
    image: Image.Image
    width_pt: float
    height_pt: float
    rotated: bool = False   # Rotated 90° to fit the content box.
    scale: float = 1.0      # < 1.0 when shrunk by the scale policy.


def prepare_image(
    image_path: Path,
    target_height_pt: float,
    dpi: int = PRINT_DPI,
    fit_box: tuple[float, float] | None = None,
    orientation: str = "rotate",
) -> PreparedImage:
    """Open, size, fit, and resample one image.

    Without ``fit_box`` this is the v1 pipeline (fixed height, no fitting).
    With it, the image must fit the box: ``rotate`` turns it 90° when only the
    rotated form fits and raises :class:`FitError` when neither does; ``scale``
    shrinks it proportionally, recording the factor for reporting.
    """
    with Image.open(image_path) as src:
        # Honor EXIF orientation, then flatten to RGB for reliable PDF embedding.
        image = ImageOps.exif_transpose(src).convert("RGB")

    aspect = image.width / image.height
    width_pt = target_height_pt * aspect
    height_pt = target_height_pt
    rotated = False
    scale = 1.0

    if fit_box is not None:
        box_w, box_h = fit_box
        if width_pt <= box_w and height_pt <= box_h:
            pass
        elif orientation == "rotate":
            if height_pt <= box_w and width_pt <= box_h:
                rotated = True
            else:
                raise FitError(
                    f"prints {format_inches(width_pt)} x {format_inches(height_pt)} "
                    f"and does not fit the {format_inches(box_w)} x "
                    f"{format_inches(box_h)} content box in either orientation; "
                    "reduce the height or use --orientation scale"
                )
        else:  # scale
            factor = min(box_w / width_pt, box_h / height_pt)
            if factor < 1.0:
                width_pt *= factor
                height_pt *= factor
                scale = factor

    height_px = max(1, round(height_pt / POINTS_PER_INCH * dpi))
    width_px = max(1, round(height_px * aspect))
    resized = image.resize((width_px, height_px), Image.LANCZOS)
    if rotated:
        resized = resized.transpose(Image.Transpose.ROTATE_90)
        width_pt, height_pt = height_pt, width_pt

    return PreparedImage(image_path, resized, width_pt, height_pt, rotated, scale)
