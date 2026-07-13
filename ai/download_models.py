"""
Auto-download PP-OCRv6 OCR models for Vietnamese text recognition.

Downloads detection, recognition, and classification models from ModelScope
(Hugging Face mirror) and saves them to the local model directory.

Usage:
    python -m ai.download_models                        # Default: ai/models/rapidocr_v6/
    python -m ai.download_models --dir /path/to/models   # Custom directory
    python -m ai.download_models --force                  # Force re-download
    python -m ai.download_models --dry-run                # Show what would be downloaded

The script resolves the best available OCR version for the installed rapidocr
package (tries PP-OCRv6 → PP-OCRv5 → PP-OCRv4) and downloads the appropriate
model files.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("download_models")

# ── Model resolution (same logic as ocr_module.py) ───────────────────────────

try:
    from rapidocr.utils.typings import (
        EngineType,
        ModelType,
        OCRVersion,
        TaskType,
    )

    RAPIDOCR_AVAILABLE = True
except ImportError:
    RAPIDOCR_AVAILABLE = False
    EngineType = None  # type: ignore[assignment]
    ModelType = None  # type: ignore[assignment]
    OCRVersion = None  # type: ignore[assignment]
    TaskType = None  # type: ignore[assignment]


def _resolve_ocr_version(*preferred: str) -> object:
    """Try preferred OCRVersion names in order, fall back to PPOCRV4."""
    for name in (*preferred, "PPOCRV4"):
        val = getattr(OCRVersion, name, None)  # type: ignore[arg-type]
        if val is not None:
            return val
    return OCRVersion.PPOCRV4  # type: ignore[attr-defined]


def _resolve_model_type(*preferred: str) -> object:
    """Try preferred ModelType names in order, fall back to MOBILE."""
    for name in (*preferred, "MOBILE"):
        val = getattr(ModelType, name, None)  # type: ignore[arg-type]
        if val is not None:
            return val
    return ModelType.MOBILE  # type: ignore[attr-defined]


def _is_v6_available() -> bool:
    """Check if PP-OCRv6 is supported by the installed rapidocr."""
    return getattr(OCRVersion, "PPOCRV6", None) is not None  # type: ignore[arg-type]


# ── Task definitions ─────────────────────────────────────────────────────────


class DownloadTask:
    """Describes a model file to download."""

    __slots__ = ("url", "filename", "sha256", "description")

    def __init__(self, url: str, filename: str, sha256: Optional[str], description: str):
        self.url = url
        self.filename = filename
        self.sha256 = sha256
        self.description = description


def _build_download_tasks() -> list[DownloadTask]:
    """Build list of model files to download for the best available version."""

    if not RAPIDOCR_AVAILABLE:
        logger.error("rapidocr is not installed. Run: pip install rapidocr onnxruntime")
        return []

    if not _is_v6_available():
        logger.info(
            "PP-OCRv6 not available in installed rapidocr. "
            "Upgrade with: pip install --upgrade rapidocr"
        )
        return _build_v4_tasks()

    return _build_v6_tasks()


def _build_v6_tasks() -> list[DownloadTask]:
    """Build download tasks for PP-OCRv6 models (+ CLS from v4)."""
    from rapidocr.inference_engine.base import FileInfo, InferSession

    tasks: list[DownloadTask] = []

    # Detection (v6, small, vi)
    det_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=_resolve_ocr_version("PPOCRV6"),
            task_type=TaskType.DET,
            lang_type="vi",
            model_type=_resolve_model_type("SMALL"),
        )
    )
    tasks.append(
        DownloadTask(
            url=det_info["model_dir"],
            filename=Path(det_info["model_dir"]).name,
            sha256=det_info.get("SHA256"),
            description="PP-OCRv6 detection (text region detection)",
        )
    )

    # Recognition (v6, small, vi)
    rec_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=_resolve_ocr_version("PPOCRV6"),
            task_type=TaskType.REC,
            lang_type="vi",
            model_type=_resolve_model_type("SMALL"),
        )
    )
    tasks.append(
        DownloadTask(
            url=rec_info["model_dir"],
            filename=Path(rec_info["model_dir"]).name,
            sha256=rec_info.get("SHA256"),
            description="PP-OCRv6 recognition (Vietnamse/Latin text recognition)",
        )
    )

    # Classification (v4, mobile, ch — same model, no v6 CLS available)
    cls_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=OCRVersion.PPOCRV4,
            task_type=TaskType.CLS,
            lang_type="ch",
            model_type=ModelType.MOBILE,
        )
    )
    tasks.append(
        DownloadTask(
            url=cls_info["model_dir"],
            filename=Path(cls_info["model_dir"]).name,
            sha256=cls_info.get("SHA256"),
            description="PP-OCRv4 classification (text orientation)",
        )
    )

    return tasks


def _build_v4_tasks() -> list[DownloadTask]:
    """Build download tasks for PP-OCRv4 models (fallback)."""
    from rapidocr.inference_engine.base import FileInfo, InferSession

    tasks: list[DownloadTask] = []

    # Detection (v4, mobile, multi)
    det_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=OCRVersion.PPOCRV4,
            task_type=TaskType.DET,
            lang_type="multi",
            model_type=ModelType.MOBILE,
        )
    )
    tasks.append(
        DownloadTask(
            url=det_info["model_dir"],
            filename=Path(det_info["model_dir"]).name,
            sha256=det_info.get("SHA256"),
            description="PP-OCRv4 detection (text region detection, multi-language)",
        )
    )

    # Recognition (v4, mobile, latin — for Vietnamese)
    rec_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=OCRVersion.PPOCRV4,
            task_type=TaskType.REC,
            lang_type="latin",
            model_type=ModelType.MOBILE,
        )
    )
    tasks.append(
        DownloadTask(
            url=rec_info["model_dir"],
            filename=Path(rec_info["model_dir"]).name,
            sha256=rec_info.get("SHA256"),
            description="PP-OCRv4 Latin recognition (Vietnamese text recognition)",
        )
    )

    # Classification (v4, mobile, ch)
    cls_info = InferSession.get_model_url(
        FileInfo(
            engine_type=EngineType.ONNXRUNTIME,
            ocr_version=OCRVersion.PPOCRV4,
            task_type=TaskType.CLS,
            lang_type="ch",
            model_type=ModelType.MOBILE,
        )
    )
    tasks.append(
        DownloadTask(
            url=cls_info["model_dir"],
            filename=Path(cls_info["model_dir"]).name,
            sha256=cls_info.get("SHA256"),
            description="PP-OCRv4 classification (text orientation)",
        )
    )

    # Latin dictionary file (for v4 recognition)
    if rec_info.get("dict_url"):
        tasks.append(
            DownloadTask(
                url=rec_info["dict_url"],
                filename=Path(rec_info["dict_url"]).name,
                sha256=None,
                description="Latin character dictionary",
            )
        )

    return tasks


# ── Download logic ───────────────────────────────────────────────────────────


def download_models(
    target_dir: Path,
    force: bool = False,
    dry_run: bool = False,
) -> list[Path]:
    """
    Download OCR models to the given directory.

    Args:
        target_dir: Directory to save model files.
        force: Re-download even if file exists.
        dry_run: Only show what would be downloaded.

    Returns:
        List of downloaded file paths (empty if dry_run or error).

    Raises:
        SystemExit: If rapidocr is not installed.
    """
    tasks = _build_download_tasks()
    if not tasks:
        logger.warning("No models to download.")
        return []

    target_dir = target_dir.resolve()
    target_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Model directory: %s", target_dir)
    logger.info("")

    downloaded: list[Path] = []

    for task in tasks:
        save_path = target_dir / task.filename
        file_exists = save_path.exists()

        if file_exists and not force:
            logger.info("  ✓ %s — already exists", task.filename)
            continue

        if dry_run:
            logger.info("  → %s (%s)", task.filename, task.description)
            continue

        # Download the file
        logger.info("  ↓ %s ...", task.filename)
        try:
            _download_file(task.url, save_path, task.sha256)
            logger.info("  ✓ %s — done (%.1f MB)", task.filename, _file_mb(save_path))
            downloaded.append(save_path)
        except Exception as exc:
            logger.error("  ✗ %s — failed: %s", task.filename, exc)
            # Try to clean up partial download
            if save_path.exists():
                save_path.unlink()

    if dry_run:
        logger.info("")
        logger.info("Dry run complete. %d file(s) would be downloaded.", len(tasks))
    else:
        n = len(downloaded)
        s = "s" if n != 1 else ""
        logger.info("")
        if force:
            logger.info("Re-downloaded %d file%s.", n, s)
        else:
            logger.info("Downloaded %d new file%s.", n, s)

    return downloaded


def _download_file(url: str, save_path: Path, sha256: Optional[str]) -> None:
    """Download a single file using RapidOCR's DownloadFile utility."""
    from rapidocr.utils.download_file import DownloadFile, DownloadFileInput

    DownloadFile.run(
        DownloadFileInput(
            file_url=url,
            save_path=save_path,
            logger=logger,
            sha256=sha256,
        )
    )


def _file_mb(path: Path) -> float:
    """Get file size in MB."""
    return path.stat().st_size / (1024 * 1024)


# ── CLI ──────────────────────────────────────────────────────────────────────


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download PP-OCRv6 OCR models for Vietnamese text recognition.",
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Target directory (default: ai/models/rapidocr_v6/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download files even if they already exist",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be downloaded without downloading",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()

    if not RAPIDOCR_AVAILABLE:
        logger.error(
            "rapidocr is required but not installed.\n"
            "Install it with: pip install rapidocr onnxruntime"
        )
        sys.exit(1)

    # Default target directory: ai/models/rapidocr_v6/
    if args.dir:
        target_dir = Path(args.dir).expanduser().resolve()
    else:
        base_dir = Path(__file__).resolve().parent.parent
        target_dir = base_dir / "ai" / "models" / "rapidocr_v6"

    logger.info("")
    logger.info("═══ OCR Model Downloader ═══")
    if _is_v6_available():
        logger.info("Target: PP-OCRv6 (multi-language, Vietnamese)")
    else:
        logger.info("Target: PP-OCRv4 (fallback, Latin)")
    logger.info("")

    download_models(
        target_dir=target_dir,
        force=args.force,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
