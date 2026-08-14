"""Shared image preprocessing helpers.

Used by both the local RapidOCR pipeline (``ai/ocr_module.py``) and the
visual Qwen-VL pipeline (``ai/question_generator.py``) so image heuristics
do not drift between the two.
"""

from __future__ import annotations

import numpy as np
from PIL import Image


def trim_white_margins(
    image: Image.Image,
    *,
    threshold: int = 240,
    pad: int = 8,
    min_content_area_ratio: float = 0.05,
    min_content_dim_ratio: float = 0.0,
) -> Image.Image:
    """Crop near-white borders from an image.

    Detects the bounding box of dark (content) pixels on a fast 400px
    downsampled scan and crops the full-resolution image to that box plus a
    small padding. Returns the input image unchanged (same object) when there
    is nothing worth cropping, so callers can rely on identity checks.

    Two complementary guards prevent over-aggressive crops:

    - ``min_content_dim_ratio`` (per-dimension): skip unless the content box
      spans at least this fraction of the *width and* height. Used by the
      visual pipeline (``0.4``) to keep full-page context for the vision model.
    - ``min_content_area_ratio`` (area-based): skip tiny dark specks such as
      watermarks or logo noise. Used by the OCR pipeline (``0.05``).

    Because ``0.4 * 0.4 = 0.16 > 0.05``, enabling the dimension guard makes
    the area guard unreachable — each pipeline keeps exactly its current
    behavior with a single shared implementation.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")

    scan = image.convert("L")
    scan.thumbnail((400, 400))
    pixels = np.asarray(scan, dtype=np.uint8)
    dark = pixels < threshold
    rows = dark.any(axis=1)
    cols = dark.any(axis=0)
    if not rows.any() or not cols.any():
        return image

    ys = np.where(rows)[0]
    xs = np.where(cols)[0]
    min_y, max_y = int(ys[0]), int(ys[-1])
    min_x, max_x = int(xs[0]), int(xs[-1])

    # Full-bleed content (dark pixels reach every edge) — nothing to trim.
    if min_x == 0 and max_x == scan.width - 1 and min_y == 0 and max_y == scan.height - 1:
        return image

    scale_x = image.width / scan.width
    scale_y = image.height / scan.height
    left = max(0, int(min_x * scale_x) - pad)
    top = max(0, int(min_y * scale_y) - pad)
    right = min(image.width, int((max_x + 1) * scale_x) + pad)
    bottom = min(image.height, int((max_y + 1) * scale_y) + pad)

    content_w = right - left
    content_h = bottom - top
    if (
        content_w < image.width * min_content_dim_ratio
        or content_h < image.height * min_content_dim_ratio
        or content_w * content_h < image.width * image.height * min_content_area_ratio
    ):
        return image

    return image.crop((left, top, right, bottom))


def estimate_skew_angle(image: Image.Image, max_angle: float = 10.0) -> float:
    """Estimate the corrective rotation angle (degrees) of a document image.

    Uses the classic projection-profile method: the angle whose rotation
    maximizes the variance of the horizontal dark-pixel profile (i.e. rows
    of text become aligned). Returns ~0 for blank pages and dark-themed
    slides where there is no text-row structure to align.
    """
    gray = image.convert("L")
    if gray.height > 300:
        scale = 300 / gray.height
        gray = gray.resize(
            (max(1, int(gray.width * scale)), 300),
            Image.Resampling.BILINEAR,
        )

    dark = np.asarray(gray, dtype=np.uint8) < 200
    dark_ratio = dark.mean()
    # Blank pages (almost no dark) and dark backgrounds (almost all dark)
    # have no usable text-row structure for angle detection.
    if dark_ratio < 0.01 or dark_ratio > 0.9:
        return 0.0

    def _profile_variance(angle_deg: float) -> float:
        rotated = gray.rotate(
            angle_deg,
            resample=Image.Resampling.BILINEAR,
            fillcolor=255,
        )
        row_counts = np.asarray(rotated, dtype=np.uint8) < 200
        row_sums = row_counts.sum(axis=1).astype(np.float64)
        if row_sums.size == 0:
            return 0.0
        return float(row_sums.var())

    # Coarse search across the range
    best_angle = 0.0
    base_score = _profile_variance(0.0)
    best_score = base_score
    angle = -max_angle
    while angle <= max_angle + 1e-9:
        score = _profile_variance(angle)
        if score > best_score:
            best_score = score
            best_angle = angle
        angle += 1.0

    # Only trust a tilted angle when it is meaningfully better aligned
    # than the original orientation. Photos or layouts without text-row
    # structure have a flat variance curve, so this prevents spurious
    # rotations of non-document content.
    if base_score <= 0 or best_score <= base_score * 1.03:
        return 0.0

    # Fine search around the coarse winner
    for sub_step in (0.25, 0.05):
        for delta in (-sub_step, sub_step):
            candidate = best_angle + delta
            if -max_angle <= candidate <= max_angle:
                score = _profile_variance(candidate)
                if score > best_score:
                    best_score = score
                    best_angle = candidate

    return round(best_angle, 2)


def deskew_image(
    image: Image.Image,
    max_angle: float = 10.0,
    min_angle: float = 0.3,
) -> Image.Image:
    """Rotate a slightly skewed scan so text lines are horizontal.

    Returns the original image object unchanged when the estimated angle is
    negligible, so callers can detect whether a rotation actually happened.
    """
    angle = estimate_skew_angle(image, max_angle=max_angle)
    if abs(angle) < min_angle:
        return image
    return image.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=True,
        fillcolor=255,
    )


def cap_longest_side(image: Image.Image, max_side: int) -> Image.Image:
    """Downscale an image so its longest side fits within ``max_side``.

    Keeps aspect ratio and only shrinks (never upscales). Returns the input
    image unchanged (same object) when it already fits, so callers can rely on
    identity checks. Used by the OCR pipeline (RAPIDOCR_MAX_SIDE, default
    4096) to avoid double-resampling and reduce memory, and by the visual
    pipeline (HF_VISUAL_IMAGE_MAX_DIM, default 1024) to cap the token cost of
    encoding images for the vision model.
    """
    if max_side <= 0:
        return image
    width, height = image.size
    longest = max(width, height)
    if longest <= max_side:
        return image
    scale = max_side / longest
    # round() (not floor) matches PIL's thumbnail() so both pipelines produce
    # identical dimensions for the same input.
    new_w = max(1, round(width * scale))
    new_h = max(1, round(height * scale))
    return image.resize((new_w, new_h), Image.Resampling.LANCZOS)
