from __future__ import annotations

import hashlib
import os
import re
import tempfile
import unicodedata
from collections import OrderedDict
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter, ImageOps
import pypdfium2 as pdfium
from rapidocr import RapidOCR
from rapidocr.utils.typings import (
    EngineType,
    LangCls,
    LangDet,
    LangRec,
    ModelType,
    OCRVersion,
)

"""try:
    import pypdfium2 as pdfium
except ImportError:  # pragma: no cover - depends on runtime dependencies
    pdfium = None

try:
    from rapidocr import RapidOCR
    from rapidocr.utils.typings import (
        EngineType,
        LangCls,
        LangDet,
        LangRec,
        ModelType,
        OCRVersion,
    )
except ImportError:  # pragma: no cover - depends on runtime dependencies
    RapidOCR = None
    EngineType = None
    LangCls = None
    LangDet = None
    LangRec = None
    ModelType = None
    OCRVersion = None"""


class OCRModule:
    # Class-level LRU cache shared across all instances.
    # Cache key: SHA256(file_path + mtime + size + params)
    # Value: extracted text
    _cache: OrderedDict[str, str] = OrderedDict()
    _MAX_CACHE_SIZE: int = 50

    @classmethod
    def _load_cache_config(cls) -> None:
        raw = os.getenv("RAPIDOCR_CACHE_SIZE", "50").strip()
        try:
            parsed = int(raw)
            cls._MAX_CACHE_SIZE = max(0, parsed)
        except (ValueError, TypeError):
            cls._MAX_CACHE_SIZE = 50

    @classmethod
    def _make_cache_key(cls, *parts: str) -> str:
        raw_key = "|".join(parts)
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    @classmethod
    def _file_fingerprint(cls, file_path: str) -> str:
        """Generate a fingerprint for a file based on path, mtime, and size."""
        try:
            stat_result = Path(file_path).stat()
            # Use getattr for platform compatibility (some systems lack st_mtime_ns)
            ns = getattr(stat_result, "st_mtime_ns", int(stat_result.st_mtime * 1_000_000_000))
            return f"{file_path}\x00{ns}\x00{stat_result.st_size}"
        except OSError:
            # File may not exist at this point (e.g., temp file cleaned up)
            return file_path

    @classmethod
    def _cache_get(cls, key: str) -> Optional[str]:
        if key not in cls._cache:
            return None
        # Move to end (most recently used) for LRU
        cls._cache.move_to_end(key)
        return cls._cache[key]

    @classmethod
    def _cache_put(cls, key: str, value: str) -> None:
        if cls._MAX_CACHE_SIZE <= 0:
            return
        cls._cache[key] = value
        cls._cache.move_to_end(key)
        while len(cls._cache) > cls._MAX_CACHE_SIZE:
            cls._cache.popitem(last=False)

    @classmethod
    def clear_cache(cls) -> None:
        cls._cache.clear()

    @classmethod
    def cache_info(cls) -> dict:
        return {
            "size": len(cls._cache),
            "max_size": cls._MAX_CACHE_SIZE,
        }

    def __init__(self):
        self._ocr_engine: Optional[RapidOCR] = None

    def extract_text(self, image_path):
        fingerprint = self._file_fingerprint(image_path)
        cache_key = self._make_cache_key("extract_text", fingerprint)

        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        image = Image.open(image_path)
        prepared_image = self._prepare_image(image)
        text = self._extract_text_from_pil_image(prepared_image)
        text = self._normalize_vietnamese_text(text)

        self._cache_put(cache_key, text)
        return text

    def extract_text_from_image_array(self, image_array):
        # Image arrays are typically ephemeral (e.g., video frames),
        # so caching is not applicable here.
        image = Image.fromarray(image_array)
        prepared_image = self._prepare_image(image)
        text = self._extract_text_from_pil_image(prepared_image)
        return self._normalize_vietnamese_text(text)

    def extract_text_from_pdf(self, pdf_path, max_pages: Optional[int] = None, page_step: int = 1):
        if pdfium is None:
            raise ImportError(
                "pypdfium2 is required for PDF OCR. Install it with `pip install pypdfium2`."
            )

        fingerprint = self._file_fingerprint(pdf_path)
        cache_key = self._make_cache_key(
            "extract_text_from_pdf",
            fingerprint,
            str(max_pages or ""),
            str(page_step),
        )

        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        document = pdfium.PdfDocument(str(pdf_path))
        extracted_pages: list[str] = []
        page_count = len(document)

        if max_pages is not None:
            page_count = min(page_count, max_pages * page_step)

        for page_index in range(0, page_count, page_step):
            page = document[page_index]
            text = self._extract_text_from_pdf_page(page)
            if text:
                extracted_pages.append(text)

        text = self._normalize_vietnamese_text("\n".join(extracted_pages))

        self._cache_put(cache_key, text)
        return text

    def _extract_text_from_pdf_page(self, page):
        try:
            if hasattr(page, "get_textpage"):
                textpage = page.get_textpage()
                extracted = textpage.get_text_range(0, textpage.count())
                if extracted and extracted.strip():
                    return extracted
        except Exception:
            pass

        rendered_page = page.render(scale=self._get_pdf_render_scale())
        pil_image = rendered_page.to_pil()
        prepared_image = self._prepare_image(pil_image)
        return self._extract_text_from_pil_image(prepared_image)

    def _extract_text_from_pil_image(self, image: Image.Image) -> str:
        ocr_engine = self._get_ocr_engine()
        ocr_result = ocr_engine(np.array(image))
        return self._normalize_ocr_result(ocr_result)

    def _get_ocr_engine(self):
        if RapidOCR is None:
            raise ImportError(
                "rapidocr and onnxruntime are required for OCR. "
                "Install them with `pip install rapidocr onnxruntime`."
            )

        if self._ocr_engine is None:
            self._ocr_engine = RapidOCR(params=self._build_rapidocr_params())
        return self._ocr_engine

    def _build_rapidocr_params(self):
        params = {
            "Global.log_level": os.getenv("RAPIDOCR_LOG_LEVEL", "error"),
            "Global.model_root_dir": str(self._get_model_root_dir()),
            "Det.engine_type": EngineType.ONNXRUNTIME,
            "Det.ocr_version": OCRVersion.PPOCRV4,
            "Det.model_type": ModelType.MOBILE,
            "Det.lang_type": LangDet.MULTI,
            "Cls.engine_type": EngineType.ONNXRUNTIME,
            "Cls.ocr_version": OCRVersion.PPOCRV4,
            "Cls.model_type": ModelType.MOBILE,
            "Cls.lang_type": LangCls.CH,
            "Rec.engine_type": EngineType.ONNXRUNTIME,
            "Rec.ocr_version": OCRVersion.PPOCRV4,
            "Rec.model_type": ModelType.MOBILE,
            # Latin works better for Vietnamese than the default Chinese recognizer.
            "Rec.lang_type": LangRec.LATIN,
        }

        local_model_dir = self._find_local_model_bundle()
        if local_model_dir is not None:
            params.update(
                {
                    "Det.model_path": str(local_model_dir / "multi_PP-OCRv3_det_mobile.onnx"),
                    "Cls.model_path": str(local_model_dir / "ch_ppocr_mobile_v2.0_cls_mobile.onnx"),
                    "Rec.model_path": str(local_model_dir / "latin_PP-OCRv3_rec_mobile.onnx"),
                    "Rec.rec_keys_path": str(local_model_dir / "latin_dict.txt"),
                }
            )

        return params

    def _find_local_model_bundle(self) -> Optional[Path]:
        candidate_dirs = []

        env_model_dir = os.getenv("RAPIDOCR_MODEL_DIR")
        if env_model_dir:
            candidate_dirs.append(Path(env_model_dir).expanduser())

        base_dir = Path(__file__).resolve().parent.parent
        candidate_dirs.extend(
            [
                base_dir / "ai" / "models" / "rapidocr",
                base_dir / "models" / "rapidocr",
            ]
        )

        required_files = (
            "multi_PP-OCRv3_det_mobile.onnx",
            "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
            "latin_PP-OCRv3_rec_mobile.onnx",
            "latin_dict.txt",
        )

        for candidate_dir in candidate_dirs:
            resolved_dir = candidate_dir.resolve()
            if all((resolved_dir / filename).exists() for filename in required_files):
                return resolved_dir

        return None

    def _get_model_root_dir(self) -> Path:
        env_root_dir = os.getenv("RAPIDOCR_MODEL_ROOT_DIR")
        if env_root_dir:
            target_dir = Path(env_root_dir).expanduser().resolve()
            target_dir.mkdir(parents=True, exist_ok=True)
            return target_dir

        target_dir = Path(tempfile.gettempdir()) / "rapidocr_models"
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    def _get_pdf_render_scale(self) -> float:
        try:
            return float(os.getenv("RAPIDOCR_PDF_RENDER_SCALE", "3.0"))
        except ValueError:
            return 3.0

    def _prepare_image(self, image: Image.Image) -> Image.Image:
        normalized = ImageOps.exif_transpose(image).convert("RGB")

        # Check if enhanced preprocessing is enabled (default: on)
        enhanced_str = os.getenv("RAPIDOCR_ENHANCED_PREPROCESSING", "1").strip()
        use_enhanced = enhanced_str.lower() in ("1", "true", "yes")

        if not use_enhanced:
            # Legacy path: autocontrast + minimal upscale
            gray = ImageOps.autocontrast(normalized.convert("L"))
            width, height = gray.size
            min_side = min(width, height)
            if min_side < 64 and min_side > 0:
                scale_factor = max(2, int(64 / min_side))
                gray = gray.resize(
                    (width * scale_factor, height * scale_factor),
                    Image.Resampling.LANCZOS,
                )
            return gray.convert("RGB")

        # === Enhanced preprocessing pipeline ===
        # Core improvements:
        #   - Higher PDF render scale (3.0 → more detail for OCR)
        #   - Median denoise (removes noise without distorting shapes)
        #   - Higher upscale threshold (200px → more pixels for small pages)
        #   - Optional binary threshold (off by default, enable for tough PDFs)
        gray = normalized.convert("L")

        # 1. Contrast stretch (remove 3% extremes — slightly more aggressive
        #    than original cutoff=2, but safe since it's histogram stretching,
        #    not binarization). Helps separate text from background.
        img = ImageOps.autocontrast(gray, cutoff=3)

        # 2. Optional binary threshold (off by default)
        #    Enable via RAPIDOCR_BINARY_THRESHOLD=value (0-255)
        #    Useful for scanned/low-contrast documents with unusual fonts
        #    where RapidOCR struggles with anti-aliased characters.
        threshold_val = os.getenv("RAPIDOCR_BINARY_THRESHOLD", "").strip()
        if threshold_val:
            try:
                t = int(threshold_val)
                if 0 <= t <= 255:
                    # Apply threshold: below → black, above → white
                    arr = np.array(img, dtype=np.uint8)
                    arr = np.where(arr > t, 255, 0).astype(np.uint8)
                    img = Image.fromarray(arr, mode="L")
            except (ValueError, TypeError):
                pass

        # 3. Median denoise — removes salt-and-pepper noise
        img = img.filter(ImageFilter.MedianFilter(size=3))

        # 4. Upscale if page is small (critical for low-res PDF renders)
        width, height = img.size
        target_min_side = 200
        min_side = min(width, height)
        if min_side < target_min_side and min_side > 0:
            scale = max(1.5, target_min_side / min_side)
            new_w = max(1, int(width * scale))
            new_h = max(1, int(height * scale))
            img = img.resize(
                (new_w, new_h), Image.Resampling.BICUBIC
            )

        return img.convert("RGB")

    def _normalize_ocr_result(self, ocr_result) -> str:
        texts = getattr(ocr_result, "txts", None)
        if texts is None:
            return ""

        return "\n".join(text.strip() for text in texts if isinstance(text, str) and text.strip())

    def _normalize_vietnamese_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace("\r", "\n")
        text = re.sub(r"\n{2,}", "\n", text)
        text = re.sub(r"[ ]{2,}", " ", text)
        text = re.sub(r"([\u00C0-\u024F])\s+([\u00C0-\u024F])", r"\1 \2", text)
        text = unicodedata.normalize("NFC", text)
        text = self._fix_common_ocr_errors(text)
        return text.strip()

    def _fix_common_ocr_errors(self, text: str) -> str:
        """Correct common OCR misrecognitions for Vietnamese.

        RapidOCR PP-OCRv4 Latin model often confuses:
        - Numbers 6/0/8 for vowels with diacritics (o6→ô, h0c→học)
        - Number 1 for letter l (1am→làm)
        - Number 5 for letter s (5o→số)
        - Corrupted diacritics via Unicode fallback (ä→à, ü→ư)
        - Stray apostrophes (lu'ng→lưng, ti'nh→tính)

        Only includes patterns that are NOT valid Vietnamese words,
        to avoid corrupting correctly-recognized text.
        """
        corrections = [
            # --- Existing corrections ---
            ("c6", "có"),
            ("C6", "Có"),
            ("chürc", "chức"),
            ("näng", "năng"),
            ("thäy", "thấy"),
            ("nhu'ng", "nhưng"),
            ("thurng", "thường"),
            ("chu'a", "chưa"),
            # --- Numbers for diacritics (6→ô) ---
            ("kh6ng", "không"),
            ("m6t", "một"),
            ("c6ng", "công"),
            ("d6ng", "đồng"),
            ("th6ng", "thông"),
            ("b6", "bộ"),
            ("ch6", "chỗ"),
            ("t6i", "tôi"),
            # --- Numbers for vowels (0→o/ô/ơ) ---
            ("h0c", "học"),
            ("m0i", "mới"),
            ("n0i", "nội"),
            # --- Number 1 for letter l ---
            ("1am", "làm"),
            ("1a", "là"),
            ("1uc", "lực"),
            ("1i", "lì"),
            ("1op", "lớp"),
            # --- Number 5 for letter s ---
            ("5o", "số"),
            ("5au", "sau"),
            # --- Missing diacritics (word not valid without tone) ---
            ("cac", "các"),
            ("hoc", "học"),
            ("phap", "pháp"),
            ("nguoi", "người"),
            ("truoc", "trước"),
            # --- Stray apostrophe for tone marks ---
            ("lu'ng", "lưng"),
            ("ti'nh", "tính"),
            ("du'ng", "dùng"),
            ("nu'c", "nức"),
            ("da'y", "dậy"),
            # --- Corrupted Unicode diacritics ---
            ("näy", "này"),
            ("tuÿ", "tùy"),
            ("sü", "sứ"),
            ("xü", "xư"),
        ]

        for wrong, correct in corrections:
            text = text.replace(wrong, correct)

        return text
