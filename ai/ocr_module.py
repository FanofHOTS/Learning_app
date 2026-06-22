from __future__ import annotations

import os
import re
import tempfile
import unicodedata
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageOps
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
    def __init__(self):
        self._ocr_engine: Optional[RapidOCR] = None

    def extract_text(self, image_path):
        image = Image.open(image_path)
        prepared_image = self._prepare_image(image)
        text = self._extract_text_from_pil_image(prepared_image)
        return self._normalize_vietnamese_text(text)

    def extract_text_from_image_array(self, image_array):
        image = Image.fromarray(image_array)
        prepared_image = self._prepare_image(image)
        text = self._extract_text_from_pil_image(prepared_image)
        return self._normalize_vietnamese_text(text)

    def extract_text_from_pdf(self, pdf_path, max_pages: Optional[int] = None, page_step: int = 1):
        if pdfium is None:
            raise ImportError(
                "pypdfium2 is required for PDF OCR. Install it with `pip install pypdfium2`."
            )

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

        return self._normalize_vietnamese_text("\n".join(extracted_pages))

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
            return float(os.getenv("RAPIDOCR_PDF_RENDER_SCALE", "2.0"))
        except ValueError:
            return 2.0

    def _prepare_image(self, image: Image.Image) -> Image.Image:
        normalized = ImageOps.exif_transpose(image).convert("RGB")
        grayscale = ImageOps.autocontrast(normalized.convert("L"))

        width, height = grayscale.size
        min_side = min(width, height)
        if min_side < 64 and min_side > 0:
            scale_factor = max(2, int(64 / min_side))
            grayscale = grayscale.resize(
                (width * scale_factor, height * scale_factor),
                Image.Resampling.LANCZOS,
            )

        return grayscale.convert("RGB")

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
        return text.strip()
