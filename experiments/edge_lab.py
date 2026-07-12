#!/usr/bin/env python3
"""Edge / line-drawing experiment lab.

Runs several classical and neural edge extractors on one image and writes each
result as a black-lines-on-white PNG at a common working size, plus a manifest
the review page reads. The goal is to compare which method best keeps the
"soul" (real structure) of the source without inventing detail.

Run:  experiments/.venv/bin/python experiments/edge_lab.py inputs/portrait.jpg
"""

from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

warnings.filterwarnings("ignore")  # timm / mediapipe import noise

HERE = Path(__file__).resolve().parent
OUT = HERE / "outputs"

# --- shared helpers -----------------------------------------------------------


def to_working(image: Image.Image, long_edge: int) -> Image.Image:
    """Downscale so the longest side is `long_edge`, preserving aspect."""
    w, h = image.size
    scale = long_edge / max(w, h)
    if scale < 1.0:
        image = image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    return image


def normalize_lines(arr: np.ndarray) -> Image.Image:
    """Return an 'L' image of black lines on a white background.

    Accepts any single-channel array; auto-inverts so the background (the
    majority tone) is white, which is the line-drawing convention.
    """
    arr = arr.astype(np.float32)
    arr = (arr - arr.min()) / (np.ptp(arr) + 1e-6) * 255.0
    if np.median(arr) < 128:  # mostly dark => edges are bright, so invert
        arr = 255.0 - arr
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), mode="L")


# --- classical methods --------------------------------------------------------


def classical_canny(rgb: Image.Image, **_) -> Image.Image:
    gray = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 60, 160)
    return normalize_lines(edges)


def classical_xdog(
    rgb: Image.Image, sigma=0.8, k=1.6, tau=0.98, phi=200.0, eps=-0.05, **_
) -> Image.Image:
    """Extended Difference-of-Gaussians (Winnemoller 2012) — a tunable,
    hand-drawn-looking classical line filter."""
    gray = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    g1 = cv2.GaussianBlur(gray, (0, 0), sigma)
    g2 = cv2.GaussianBlur(gray, (0, 0), sigma * k)
    dog = g1 - tau * g2
    result = np.where(dog >= eps, 1.0, 1.0 + np.tanh(phi * (dog - eps)))
    return normalize_lines(result * 255.0)


def pillow_find_edges(rgb: Image.Image, **_) -> Image.Image:
    from PIL import ImageFilter
    edges = rgb.convert("L").filter(ImageFilter.FIND_EDGES)
    return normalize_lines(np.array(edges))


# --- neural methods (controlnet_aux, weights auto-pulled from HuggingFace) -----

_NEURAL_CACHE: dict[str, object] = {}


def _neural(kind: str):
    if kind not in _NEURAL_CACHE:
        from controlnet_aux import HEDdetector, PidiNetDetector, LineartDetector
        loaders = {
            "hed": lambda: HEDdetector.from_pretrained("lllyasviel/Annotators"),
            "pidi": lambda: PidiNetDetector.from_pretrained("lllyasviel/Annotators"),
            "lineart": lambda: LineartDetector.from_pretrained("lllyasviel/Annotators"),
        }
        _NEURAL_CACHE[kind] = loaders[kind]()
    return _NEURAL_CACHE[kind]


def _run_neural(det, rgb: Image.Image, **kwargs) -> Image.Image:
    res = max(rgb.size)
    out = det(rgb, detect_resolution=res, image_resolution=res, **kwargs)
    out = out.resize(rgb.size, Image.LANCZOS).convert("L")
    return normalize_lines(np.array(out))


def neural_hed(rgb, **_):
    return _run_neural(_neural("hed"), rgb)


def neural_hed_scribble(rgb, **_):
    return _run_neural(_neural("hed"), rgb, scribble=True)


def neural_pidinet(rgb, **_):
    return _run_neural(_neural("pidi"), rgb)


def neural_lineart(rgb, **_):
    return _run_neural(_neural("lineart"), rgb, coarse=False)


def neural_lineart_coarse(rgb, **_):
    return _run_neural(_neural("lineart"), rgb, coarse=True)


# --- registry -----------------------------------------------------------------
# (name, family, label, description, fn)
METHODS = [
    ("canny", "classical", "Canny", "Gradient + hysteresis. Sharp, thin, but binary and can fragment.", classical_canny),
    ("xdog", "classical", "XDoG", "Extended Difference-of-Gaussians. Tunable, hand-drawn feel.", classical_xdog),
    ("find_edges", "classical", "Pillow Find Edges", "Laplacian kernel. Fast baseline, noisier.", pillow_find_edges),
    ("hed", "neural", "HED", "Holistically-Nested Edge Detection. Soft, structure-aware edges.", neural_hed),
    ("hed_scribble", "neural", "HED (scribble)", "HED thresholded to bold scribble strokes.", neural_hed_scribble),
    ("pidinet", "neural", "PiDiNet", "Pixel-difference net. Clean soft edges, lightweight.", neural_pidinet),
    ("lineart", "neural", "Lineart", "Realistic line-art net. Fine, illustrative contours.", neural_lineart),
    ("lineart_coarse", "neural", "Lineart (coarse)", "Line-art net, coarse pass. Bolder, fewer lines.", neural_lineart_coarse),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", type=Path, help="Source image path.")
    ap.add_argument("--long-edge", type=int, default=1000, help="Working long-edge px.")
    ap.add_argument("--only", nargs="*", help="Run only these method names.")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    src = Image.open(args.input).convert("RGB")
    work = to_working(src, args.long_edge)
    work.save(OUT / "original.png")
    print(f"original -> {work.size}")

    manifest = {"original": "original.png", "size": work.size, "methods": []}
    for name, family, label, desc, fn in METHODS:
        if args.only and name not in args.only:
            continue
        try:
            result = fn(work)
            fname = f"{name}.png"
            result.save(OUT / fname)
            manifest["methods"].append(
                {"name": name, "family": family, "label": label,
                 "description": desc, "file": fname}
            )
            print(f"  ok: {label}")
        except Exception as exc:  # keep going if one method fails
            print(f"  FAIL: {label}: {exc}")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"wrote {len(manifest['methods'])} methods -> {OUT/'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
