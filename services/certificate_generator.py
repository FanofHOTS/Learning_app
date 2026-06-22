from __future__ import annotations

import io
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent.parent

FONT_CANDIDATES = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in FONT_CANDIDATES:
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()


def _wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [text]

    lines: list[str] = []
    current_line = words[0]

    for word in words[1:]:
        candidate = f"{current_line} {word}"
        bbox = font.getbbox(candidate)
        if bbox[2] - bbox[0] <= max_width:
            current_line = candidate
        else:
            lines.append(current_line)
            current_line = word

    lines.append(current_line)
    return lines


def _draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.ImageFont,
    center_x: int,
    start_y: int,
    fill: str,
    line_spacing: int = 12,
) -> int:
    y = start_y
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        draw.text((center_x - line_width // 2, y), line, font=font, fill=fill)
        y += (bbox[3] - bbox[1]) + line_spacing
    return y


def _open_template_image(template_path: Optional[Path]) -> Optional[Image.Image]:
    """Open the template image if the path exists and is a supported format."""
    if template_path is None:
        return None
    try:
        if template_path.exists():
            img = Image.open(template_path)
            img.verify()
            # Re-open after verify (verify closes the file)
            return Image.open(template_path)
    except Exception:
        pass
    return None


def generate_certificate_image_bytes(
    *,
    student_name: str,
    course_title: str,
    instructor_name: str,
    certificate_code: str,
    issued_at: datetime,
    final_score: int | None,
    template_path: Optional[Path] = None,
) -> bytes:
    """
    Generate a certificate image and return it as PNG bytes.

    If template_path is provided, it is used as the background image.
    Otherwise a clean programmatic certificate is generated.
    """
    width, height = 1600, 1131
    template_image = _open_template_image(template_path)

    if template_image is not None:
        # Resize template to match certificate dimensions
        image = template_image.resize((width, height), Image.LANCZOS).convert("RGB")
    else:
        image = Image.new("RGB", (width, height), "#fdfbf7")

    draw = ImageDraw.Draw(image)

    border_color = "#1e3a5f"
    accent_color = "#c9a227"
    text_color = "#1a1a1a"
    muted_color = "#555555"

    # Only draw decorative borders if no template is used (templates may have their own design)
    if template_image is None:
        draw.rectangle([40, 40, width - 40, height - 40], outline=border_color, width=4)
        draw.rectangle([56, 56, width - 56, height - 56], outline=accent_color, width=2)

    title_font = _load_font(56)
    subtitle_font = _load_font(34)
    body_font = _load_font(30)
    small_font = _load_font(22)

    center_x = width // 2
    _draw_centered_lines(
        draw,
        ["CHỨNG CHỈ HOÀN THÀNH"],
        title_font,
        center_x,
        120,
        border_color,
    )
    _draw_centered_lines(
        draw,
        ["Chứng nhận rằng"],
        body_font,
        center_x,
        230,
        muted_color,
    )

    name_lines = _wrap_text(student_name, subtitle_font, width - 240)
    y_after_name = _draw_centered_lines(
        draw,
        name_lines,
        subtitle_font,
        center_x,
        300,
        text_color,
    )

    _draw_centered_lines(
        draw,
        ["đã hoàn thành khóa học"],
        body_font,
        center_x,
        y_after_name + 20,
        muted_color,
    )

    course_lines = _wrap_text(course_title, subtitle_font, width - 240)
    y_after_course = _draw_centered_lines(
        draw,
        course_lines,
        subtitle_font,
        center_x,
        y_after_name + 80,
        border_color,
    )

    instructor_text = f"Giảng viên: {instructor_name}"
    _draw_centered_lines(
        draw,
        [instructor_text],
        body_font,
        center_x,
        y_after_course + 30,
        muted_color,
    )

    if final_score is not None:
        score_text = f"Điểm tổng kết: {final_score}"
        _draw_centered_lines(
            draw,
            [score_text],
            body_font,
            center_x,
            y_after_course + 90,
            text_color,
        )

    issued_text = issued_at.strftime("Ngày cấp: %d/%m/%Y")
    _draw_centered_lines(
        draw,
        [issued_text],
        small_font,
        center_x,
        height - 220,
        muted_color,
    )
    _draw_centered_lines(
        draw,
        [f"Mã chứng chỉ: {certificate_code}"],
        small_font,
        center_x,
        height - 170,
        muted_color,
    )

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


# Legacy wrapper for backward compatibility
def generate_certificate_image(
    *,
    student_name: str,
    course_title: str,
    instructor_name: str,
    certificate_code: str,
    issued_at: datetime,
    final_score: int | None,
    output_path: Path,
    template_path: Optional[Path] = None,
) -> None:
    png_bytes = generate_certificate_image_bytes(
        student_name=student_name,
        course_title=course_title,
        instructor_name=instructor_name,
        certificate_code=certificate_code,
        issued_at=issued_at,
        final_score=final_score,
        template_path=template_path,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(png_bytes)
