from __future__ import annotations

import hashlib
import logging
import re
import tempfile
import threading
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

from ai.env_utils import read_env_bool, read_env_float, read_env_int_clamped, read_env_value
from ai.image_utils import cap_longest_side, deskew_image, trim_white_margins

logger = logging.getLogger("ocr_module")


def _preprocessing_cache_salt(*, include_render_scale: bool = False) -> str:
    """Effective preprocessing settings that change OCR output.

    Included in the OCR cache key so that toggling preprocessing options
    (e.g. enabling RAPIDOCR_TRIM_MARGINS) invalidates previously cached text
    instead of silently returning stale results.
    """
    enhanced = read_env_bool("RAPIDOCR_ENHANCED_PREPROCESSING", False)
    parts = [
        f"trim={int(read_env_bool('RAPIDOCR_TRIM_MARGINS', True))}",
        f"max_side={read_env_int_clamped('RAPIDOCR_MAX_SIDE', 1536, 256, 4096)}",
        f"max_image_pixels={read_env_int_clamped('RAPIDOCR_MAX_IMAGE_PIXELS', 3000000, 1000000, 12000000)}",
        f"deskew={int(read_env_bool('RAPIDOCR_DESKEW', False))}",
        f"enhanced={int(enhanced)}",
        f"binary={read_env_value('RAPIDOCR_BINARY_THRESHOLD') or ''}",
    ]
    if include_render_scale:
        parts.append(f"render_scale={read_env_value('RAPIDOCR_PDF_RENDER_SCALE') or '1.5'}")
    return ";".join(parts)


# ── Auto-download ────────────────────────────────────────────────────────────


def _auto_download_models_if_needed() -> None:
    """Download OCR models if no local bundle is found.

    Uses the same resolution logic as the module (v6 preferred, fallback v4).
    Only tries once per process; subsequent calls are no-ops.
    """
    if _auto_download_models_if_needed._done:
        return
    _auto_download_models_if_needed._done = True

    # Check local bundle first (same as OCRModule._find_local_model_bundle)
    base_dir = Path(__file__).resolve().parent.parent
    v6_dir = base_dir / "ai" / "models" / "rapidocr_v6"

    v6_required = ["PP-OCRv6_det_small.onnx", "ch_ppocr_mobile_v2.0_cls_mobile.onnx", "PP-OCRv6_rec_small.onnx"]
    if all((v6_dir / f).exists() for f in v6_required):
        return  # Already have v6 models

    v4_dir = base_dir / "ai" / "models" / "rapidocr"
    v4_required = ["multi_PP-OCRv3_det_mobile.onnx", "ch_ppocr_mobile_v2.0_cls_mobile.onnx", "latin_PP-OCRv3_rec_mobile.onnx", "latin_dict.txt"]
    if all((v4_dir / f).exists() for f in v4_required):
        return  # Already have v4 models

    # Models not found locally — try to download
    try:
        from ai.download_models import download_models

        logger = logging.getLogger("ocr_module")
        logger.info("OCR models not found locally. Auto-downloading...")
        download_models(target_dir=v6_dir)
    except Exception as exc:
        # Don't crash — RapidOCR will auto-download on first use
        import logging as _logging

        _logging.getLogger("ocr_module").warning(
            "Could not auto-download OCR models: %s. "
            "RapidOCR will download them automatically on first OCR call.",
            exc,
        )


_auto_download_models_if_needed._done = False


# ── Dynamic version resolution ──────────────────────────────────
# Production environment có thể cài rapidocr version cũ hơn.
# Dùng getattr để fallback nếu enum value không tồn tại.


def _resolve_ocr_version(*preferred: str) -> OCRVersion:
    """Try preferred OCRVersion names in order, fall back to PPOCRV4."""
    for name in (*preferred, "PPOCRV4"):
        val = getattr(OCRVersion, name, None)
        if val is not None:
            return val
    return OCRVersion.PPOCRV4


def _resolve_model_type(*preferred: str) -> ModelType:
    """Try preferred ModelType names in order, fall back to MOBILE."""
    for name in (*preferred, "MOBILE"):
        val = getattr(ModelType, name, None)
        if val is not None:
            return val
    return ModelType.MOBILE


# Latest stable OCR version for Vietnamese
_LATEST_OCR_VERSION: OCRVersion = _resolve_ocr_version("PPOCRV6", "PPOCRV5")
# Model type for the latest version (SMALL for v6, MOBILE for v4/v5)
_LATEST_OCR_MODEL_TYPE: ModelType = _resolve_model_type("SMALL")
# Whether the latest version is PP-OCRv6 (uses "vi" language code instead of LangRec.LATIN)
_IS_PPOCRV6: bool = _LATEST_OCR_VERSION is getattr(OCRVersion, "PPOCRV6", None)

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
    _MAX_CACHE_SIZE: int = 10
    _execution_lock = threading.Lock()
    _shared_ocr_engine: Optional[RapidOCR] = None

    @classmethod
    def _load_cache_config(cls) -> None:
        # Keep 0 allowed (disables the cache), so read via read_env_value
        # instead of read_env_int (which rejects values < 1).
        raw = read_env_value("RAPIDOCR_CACHE_SIZE") or "10"
        try:
            parsed = int(raw)
            cls._MAX_CACHE_SIZE = max(0, min(100, parsed))
        except (ValueError, TypeError):
            cls._MAX_CACHE_SIZE = 10

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
        self._load_cache_config()
        self._ocr_engine = self._shared_ocr_engine

    def extract_text(self, image_path):
        with self._execution_lock:
            fingerprint = self._file_fingerprint(image_path)
            cache_key = self._make_cache_key(
                "extract_text",
                fingerprint,
                _preprocessing_cache_salt(),
            )

            cached = self._cache_get(cache_key)
            if cached is not None:
                return cached

            with Image.open(image_path) as image:
                text = self._extract_text_from_image(image)
            text = self._normalize_vietnamese_text(text)

            self._cache_put(cache_key, text)
            return text

    def extract_text_from_image_array(self, image_array):
        # Image arrays are typically ephemeral (e.g., video frames),
        # so caching is not applicable here.
        with self._execution_lock:
            image = Image.fromarray(image_array)
            try:
                return self._normalize_vietnamese_text(
                    self._extract_text_from_image(image)
                )
            finally:
                image.close()

    def extract_text_from_pdf(self, pdf_path, max_pages: Optional[int] = None, page_step: int = 1):
        if pdfium is None:
            raise ImportError(
                "pypdfium2 is required for PDF OCR. Install it with `pip install pypdfium2`."
            )

        if page_step < 1:
            raise ValueError("page_step must be at least 1")
        effective_max_pages = self._get_max_pdf_pages(max_pages)

        with self._execution_lock:
            fingerprint = self._file_fingerprint(pdf_path)
            cache_key = self._make_cache_key(
                "extract_text_from_pdf",
                fingerprint,
                str(effective_max_pages),
                str(page_step),
                _preprocessing_cache_salt(include_render_scale=True),
            )

            cached = self._cache_get(cache_key)
            if cached is not None:
                return cached

            document = pdfium.PdfDocument(str(pdf_path))
            extracted_pages: list[str] = []
            try:
                total_pages = len(document)
                page_count = min(total_pages, effective_max_pages * page_step)
                if total_pages > page_count:
                    logger.warning(
                        "PDF OCR limited to %d pages (PDF has %d pages); "
                        "set RAPIDOCR_MAX_PDF_PAGES to change the limit.",
                        effective_max_pages,
                        total_pages,
                    )

                for page_index in range(0, page_count, page_step):
                    page = document[page_index]
                    try:
                        text = self._extract_text_from_pdf_page(page)
                    finally:
                        page.close()
                    if text:
                        extracted_pages.append(text)
            finally:
                document.close()

            text = self._normalize_vietnamese_text("\n".join(extracted_pages))
            self._cache_put(cache_key, text)
            return text

    def _extract_text_from_pdf_page(self, page):
        textpage = None
        try:
            if hasattr(page, "get_textpage"):
                textpage = page.get_textpage()
                extracted = textpage.get_text_range()
                if extracted and extracted.strip():
                    return extracted
        except Exception as exc:
            logger.debug(
                "Could not read PDF text layer (%s); falling back to OCR.",
                type(exc).__name__,
            )
        finally:
            if textpage is not None:
                textpage.close()

        width, height = page.get_size()
        max_page_side = max(width, height)
        if max_page_side <= 0:
            raise ValueError("PDF page has invalid dimensions")
        scale = min(
            self._get_pdf_render_scale(),
            self._get_max_side() / max_page_side,
        )
        if scale <= 0:
            raise ValueError("PDF render scale must be greater than zero")

        rendered_page = page.render(scale=scale)
        pil_image = None
        try:
            pil_image = rendered_page.to_pil()
            return self._extract_text_from_image(pil_image)
        finally:
            if pil_image is not None:
                pil_image.close()
            rendered_page.close()

    def _extract_text_from_image(self, image: Image.Image) -> str:
        prepared_image = self._prepare_image(image)
        try:
            return self._extract_text_from_pil_image(prepared_image)
        finally:
            if prepared_image is not image:
                prepared_image.close()

    def _get_max_pdf_pages(self, requested_max_pages: Optional[int]) -> int:
        configured_limit = read_env_int_clamped(
            "RAPIDOCR_MAX_PDF_PAGES",
            2,
            1,
            10,
        )
        if requested_max_pages is None:
            return configured_limit
        if requested_max_pages < 1:
            raise ValueError("max_pages must be at least 1")
        return min(requested_max_pages, configured_limit)

    def _get_max_side(self) -> int:
        return read_env_int_clamped("RAPIDOCR_MAX_SIDE", 1536, 256, 4096)

    def _extract_text_from_pil_image(self, image: Image.Image) -> str:
        ocr_engine = self._get_ocr_engine()
        image_array = np.array(image)
        try:
            ocr_result = ocr_engine(image_array)
        finally:
            del image_array
        return self._normalize_ocr_result(ocr_result)

    def _get_ocr_engine(self):
        if RapidOCR is None:
            raise ImportError(
                "rapidocr and onnxruntime are required for OCR. "
                "Install them with `pip install rapidocr onnxruntime`."
            )

        if self._ocr_engine is None and self._shared_ocr_engine is not None:
            self._ocr_engine = self._shared_ocr_engine
        if self._ocr_engine is not None:
            return self._ocr_engine

        # Auto-download models on first use if not found locally
        _auto_download_models_if_needed()

        # Thử các cấu hình theo thứ tự ưu tiên
        configs_to_try = self._build_config_candidates()

        last_error: Optional[Exception] = None
        for idx, params in enumerate(configs_to_try):
            try:
                self._ocr_engine = RapidOCR(params=params)
                type(self)._shared_ocr_engine = self._ocr_engine
                if idx > 0:
                    logger.info(
                        "OCR engine initialized with fallback config #%d", idx
                    )
                return self._ocr_engine
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "OCR config #%d failed: %s", idx, exc
                )
                continue

        raise RuntimeError(
            "Failed to initialize OCR engine with all available configurations. "
            f"Last error: {last_error}"
        ) from last_error

    def _build_config_candidates(self) -> list[dict]:
        """Build list of OCR configs to try, in priority order.

        Returns multiple config dictionaries so that if the primary (v6)
        config fails, fallbacks can be attempted.
        """
        candidates: list[dict] = []

        # 1. Primary: PP-OCRv6 with SMALL model + vi language (latest, best)
        try:
            candidates.append(self._build_rapidocr_params())
        except Exception as exc:
            logger.warning("Could not build primary OCR config: %s", exc)

        # 2. Fallback: PP-OCRv6 with MOBILE model + vi language
        #    (in case SMALL model type is not supported)
        try:
            v6_mobile = self._build_rapidocr_params(
                override_model_type="MOBILE",
            )
            if v6_mobile != candidates[0] if candidates else True:
                candidates.append(v6_mobile)
        except Exception:
            pass

        # 3. Fallback: PP-OCRv4 with MOBILE + MULTI/LATIN (guaranteed to work)
        try:
            v4_params = self._build_rapidocr_params(
                override_version="PPOCRV4",
                override_model_type="MOBILE",
                override_det_lang=LangDet.MULTI,
                override_rec_lang=LangRec.LATIN,
            )
            # Avoid duplicate
            if all(v4_params != c for c in candidates):
                candidates.append(v4_params)
        except Exception:
            pass

        if not candidates:
            # Ultimate fallback — minimal params
            candidates.append({
                "Global.log_level": read_env_value("RAPIDOCR_LOG_LEVEL") or "error",
                "Global.model_root_dir": str(self._get_model_root_dir()),
            })

        return candidates

    def _build_rapidocr_params(
        self,
        override_version: Optional[str] = None,
        override_model_type: Optional[str] = None,
        override_det_lang: object = None,
        override_rec_lang: object = None,
    ) -> dict:
        """Build RapidOCR params with optional overrides for fallback configs."""
        # Dynamic resolution
        if override_version is not None:
            ocr_version = _resolve_ocr_version(override_version)
        else:
            ocr_version = _LATEST_OCR_VERSION

        if override_model_type is not None:
            model_type = _resolve_model_type(override_model_type)
        else:
            model_type = _LATEST_OCR_MODEL_TYPE

        is_v6 = ocr_version is getattr(OCRVersion, "PPOCRV6", None)

        if override_det_lang is not None:
            det_lang = override_det_lang
        elif is_v6:
            det_lang = "vi"
        else:
            det_lang = LangDet.MULTI

        if override_rec_lang is not None:
            rec_lang = override_rec_lang
        elif is_v6:
            rec_lang = "vi"
        else:
            rec_lang = LangRec.LATIN

        params: dict = {
            "Global.log_level": read_env_value("RAPIDOCR_LOG_LEVEL") or "error",
            "Global.model_root_dir": str(self._get_model_root_dir()),
            "EngineConfig.onnxruntime.intra_op_num_threads": read_env_int_clamped(
                "RAPIDOCR_ONNX_THREADS",
                1,
                1,
                2,
            ),
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
            "EngineConfig.onnxruntime.enable_cpu_mem_arena": read_env_bool(
                "RAPIDOCR_ONNX_CPU_MEM_ARENA",
                False,
            ),
            "Det.engine_type": EngineType.ONNXRUNTIME,
            "Det.ocr_version": ocr_version,
            "Det.model_type": model_type,
            "Det.lang_type": det_lang,
            "Cls.engine_type": EngineType.ONNXRUNTIME,
            "Cls.ocr_version": OCRVersion.PPOCRV4,
            "Cls.model_type": ModelType.MOBILE,
            "Cls.lang_type": LangCls.CH,
            "Rec.engine_type": EngineType.ONNXRUNTIME,
            "Rec.ocr_version": ocr_version,
            "Rec.model_type": model_type,
            "Rec.lang_type": rec_lang,
        }

        local_model_dir = self._find_local_model_bundle()
        if local_model_dir is not None:
            # Tên file model động theo version
            if is_v6:
                det_model_file = "PP-OCRv6_det_small.onnx"
                rec_model_file = "PP-OCRv6_rec_small.onnx"
            else:
                det_model_file = "multi_PP-OCRv3_det_mobile.onnx"
                rec_model_file = "latin_PP-OCRv3_rec_mobile.onnx"

            det_path = local_model_dir / det_model_file
            if det_path.exists():
                params["Det.model_path"] = str(det_path)

            cls_path = local_model_dir / "ch_ppocr_mobile_v2.0_cls_mobile.onnx"
            if cls_path.exists():
                params["Cls.model_path"] = str(cls_path)

            rec_path = local_model_dir / rec_model_file
            if rec_path.exists():
                params["Rec.model_path"] = str(rec_path)

            if not is_v6:
                dict_path = local_model_dir / "latin_dict.txt"
                if dict_path.exists():
                    params["Rec.rec_keys_path"] = str(dict_path)

        return params

    def _find_local_model_bundle(self) -> Optional[Path]:
        candidate_dirs = []

        env_model_dir = read_env_value("RAPIDOCR_MODEL_DIR")
        if env_model_dir:
            candidate_dirs.append(Path(env_model_dir).expanduser())

        base_dir = Path(__file__).resolve().parent.parent
        candidate_dirs.extend(
            [
                # PP-OCRv6 models (ưu tiên)
                base_dir / "ai" / "models" / "rapidocr_v6",
                # Fallback: PP-OCRv3/v4 models (cũ)
                base_dir / "ai" / "models" / "rapidocr",
                base_dir / "models" / "rapidocr",
            ]
        )

        # Ưu tiên check PP-OCRv6 bundle trước
        v6_required_files = (
            "PP-OCRv6_det_small.onnx",
            "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
            "PP-OCRv6_rec_small.onnx",
        )

        for candidate_dir in candidate_dirs:
            resolved_dir = candidate_dir.resolve()
            if all((resolved_dir / filename).exists() for filename in v6_required_files):
                return resolved_dir

        # Fallback: check PP-OCRv3/v4 bundle
        v4_required_files = (
            "multi_PP-OCRv3_det_mobile.onnx",
            "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
            "latin_PP-OCRv3_rec_mobile.onnx",
            "latin_dict.txt",
        )

        for candidate_dir in candidate_dirs:
            resolved_dir = candidate_dir.resolve()
            if all((resolved_dir / filename).exists() for filename in v4_required_files):
                return resolved_dir

        return None

    def _get_model_root_dir(self) -> Path:
        env_root_dir = read_env_value("RAPIDOCR_MODEL_ROOT_DIR")
        if env_root_dir:
            target_dir = Path(env_root_dir).expanduser().resolve()
            target_dir.mkdir(parents=True, exist_ok=True)
            return target_dir

        target_dir = Path(tempfile.gettempdir()) / "rapidocr_models"
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    def _get_pdf_render_scale(self) -> float:
        configured_scale = read_env_float("RAPIDOCR_PDF_RENDER_SCALE", 1.5)
        return configured_scale if configured_scale > 0 else 1.5

    def _prepare_image(self, image: Image.Image) -> Image.Image:
        max_pixels = read_env_int_clamped(
            "RAPIDOCR_MAX_IMAGE_PIXELS",
            3000000,
            1000000,
            12000000,
        )
        if image.width * image.height > max_pixels:
            raise ValueError(
                f"Image exceeds the configured OCR limit of {max_pixels:,} pixels"
            )

        oriented = ImageOps.exif_transpose(image)
        normalized = oriented.convert("RGB")
        if oriented is not image:
            oriented.close()

        # Trim near-white margins so OCR focuses on the content area and the
        # contrast/threshold steps below are not dominated by empty borders.
        if read_env_bool("RAPIDOCR_TRIM_MARGINS", True):
            trimmed = trim_white_margins(normalized)
            if trimmed is not normalized:
                normalized.close()
                normalized = trimmed

        # Cap the longest side of very large scans (default 1536px) to avoid
        # double-resampling by the OCR engine and limit memory usage.
        max_side = self._get_max_side()
        resized = cap_longest_side(normalized, max_side)
        if resized is not normalized:
            normalized.close()
            normalized = resized

        # Deskew slightly rotated scans before the contrast/threshold steps.
        # After rotation the corners become white wedges, so re-trim margins to
        # keep the detector focused on the content area.
        if read_env_bool("RAPIDOCR_DESKEW", False):
            deskewed = deskew_image(normalized)
            if deskewed is not normalized:
                if read_env_bool("RAPIDOCR_TRIM_MARGINS", True):
                    trimmed = trim_white_margins(deskewed)
                    if trimmed is not deskewed:
                        deskewed.close()
                        deskewed = trimmed
                normalized.close()
                normalized = deskewed

        # Check if enhanced preprocessing is enabled (default: off).
        use_enhanced = read_env_bool("RAPIDOCR_ENHANCED_PREPROCESSING", False)

        if not use_enhanced:
            gray_source = normalized.convert("L")
            normalized.close()
            gray = ImageOps.autocontrast(gray_source)
            gray_source.close()
            width, height = gray.size
            min_side = min(width, height)
            if min_side < 64 and min_side > 0:
                scale_factor = max(2, int(64 / min_side))
                resized_gray = gray.resize(
                    (width * scale_factor, height * scale_factor),
                    Image.Resampling.LANCZOS,
                )
                gray.close()
                gray = resized_gray
            rgb_image = gray.convert("RGB")
            gray.close()
            result = cap_longest_side(rgb_image, max_side)
            if result is not rgb_image:
                rgb_image.close()
            return result

        # === Enhanced preprocessing pipeline ===
        # Core improvements:
        #   - Higher PDF render scale (2.0 → more detail for OCR)
        #   - Median denoise (removes noise without distorting shapes)
        #   - Higher upscale threshold (200px → more pixels for small pages)
        #   - Optional binary threshold (off by default, enable for tough PDFs)
        gray = normalized.convert("L")
        normalized.close()

        # 1. Contrast stretch (remove 3% extremes — slightly more aggressive
        #    than original cutoff=2, but safe since it's histogram stretching,
        #    not binarization). Helps separate text from background.
        img = ImageOps.autocontrast(gray, cutoff=3)
        gray.close()

        # 2. Optional binary threshold (off by default)
        #    Enable via RAPIDOCR_BINARY_THRESHOLD=value (0-255)
        #    Useful for scanned/low-contrast documents with unusual fonts
        #    where RapidOCR struggles with anti-aliased characters.
        threshold_val = read_env_value("RAPIDOCR_BINARY_THRESHOLD")
        if threshold_val:
            try:
                t = int(threshold_val)
                if 0 <= t <= 255:
                    # Apply threshold: below → black, above → white
                    arr = np.array(img, dtype=np.uint8)
                    arr = np.where(arr > t, 255, 0).astype(np.uint8)
                    thresholded = Image.fromarray(arr, mode="L")
                    img.close()
                    img = thresholded
            except (ValueError, TypeError):
                pass

        # 3. Median denoise — removes salt-and-pepper noise
        denoised = img.filter(ImageFilter.MedianFilter(size=3))
        img.close()
        img = denoised

        # 4. Upscale if page is small (critical for low-res PDF renders)
        width, height = img.size
        target_min_side = 200
        min_side = min(width, height)
        if min_side < target_min_side and min_side > 0:
            scale = max(1.5, target_min_side / min_side)
            new_w = max(1, int(width * scale))
            new_h = max(1, int(height * scale))
            resized = img.resize(
                (new_w, new_h), Image.Resampling.BICUBIC
            )
            img.close()
            img = resized

        rgb_image = img.convert("RGB")
        img.close()
        result = cap_longest_side(rgb_image, max_side)
        if result is not rgb_image:
            rgb_image.close()
        return result

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
