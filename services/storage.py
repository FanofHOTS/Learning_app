from __future__ import annotations

import mimetypes
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import HTTPException, UploadFile

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_UPLOAD_DIR = BASE_DIR / "uploads"
BLOB_HOST_MARKER = ".blob.vercel-storage.com"
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg"}


def get_upload_dir() -> Path:
    configured_path = os.getenv("UPLOAD_DIR", "").strip()
    if not configured_path:
        return DEFAULT_UPLOAD_DIR

    upload_dir = Path(configured_path)
    if upload_dir.is_absolute():
        return upload_dir

    return BASE_DIR / upload_dir


def get_storage_backend() -> str:
    configured_backend = os.getenv("STORAGE_BACKEND", "auto").strip().lower()
    if configured_backend not in {"auto", "local", "blob"}:
        configured_backend = "auto"

    if configured_backend == "blob":
        return "blob"
    if configured_backend == "local":
        return "local"

    return "blob" if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip() else "local"


def is_running_on_vercel() -> bool:
    return os.getenv("VERCEL", "").strip() == "1"


def normalize_filename(filename: str) -> str:
    clean_name = Path(filename).name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Tệp tải lên không có tên hợp lệ.")

    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(clean_name).stem).strip("._-")
    suffix = Path(clean_name).suffix.lower()

    if not stem:
        stem = "uploaded-file"

    return f"{stem}{suffix}"


def get_file_extension(filename_or_url: str) -> str:
    return Path(urlsplit(filename_or_url).path).suffix.lower()


def build_upload_relative_path(prefix: str, filename: str) -> Path:
    timestamp = datetime.now(timezone.utc)
    return (
        Path(prefix)
        / timestamp.strftime("%Y")
        / timestamp.strftime("%m")
        / f"{uuid4().hex}_{filename}"
    )


def ensure_local_upload_destination(relative_path: Path) -> Path:
    if is_running_on_vercel():
        raise HTTPException(
            status_code=503,
            detail=(
                "Môi trường Vercel không lưu bền vững file upload trên filesystem. "
                "Hãy cấu hình BLOB_READ_WRITE_TOKEN hoặc STORAGE_BACKEND=blob."
            ),
        )

    destination = get_upload_dir() / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    return destination


def guess_content_type(filename: str, upload_file: UploadFile) -> str:
    return (
        upload_file.content_type
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )


def guess_content_type_from_bytes(filename: str, contents: bytes) -> str:
    """Guess content type from filename; falls back to application/octet-stream."""
    guessed = mimetypes.guess_type(filename)[0]
    if guessed:
        return guessed
    if contents[:4] == b"\x89PNG":
        return "image/png"
    if contents[:4] == b"\xff\xd8":
        return "image/jpeg"
    if contents[:2] == b"BM":
        return "image/bmp"
    if contents[:4] == b"%PDF":
        return "application/pdf"
    return "application/octet-stream"


def upload_to_blob(pathname: str, contents: bytes, content_type: str) -> str:
    try:
        from vercel.blob import BlobClient
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Chưa cài đặt gói Python 'vercel' để upload lên Vercel Blob.",
        ) from exc

    if not os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        raise HTTPException(
            status_code=503,
            detail="Thiếu BLOB_READ_WRITE_TOKEN để upload file lên Vercel Blob.",
        )

    try:
        client = BlobClient()
        blob = client.put(
            pathname,
            contents,
            access="public",
            content_type=content_type,
            add_random_suffix=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Không thể upload file lên Vercel Blob: {exc}",
        ) from exc

    return blob.url


def upload_to_local_storage(relative_path: Path, contents: bytes) -> str:
    destination = ensure_local_upload_destination(relative_path)
    destination.write_bytes(contents)
    return f"/uploads/{relative_path.as_posix()}"


def store_file(relative_path: Path, contents: bytes, content_type: str) -> str:
    """Store a file using the active backend (local or Vercel Blob)."""
    if get_storage_backend() == "blob":
        return upload_to_blob(relative_path.as_posix(), contents, content_type)
    return upload_to_local_storage(relative_path, contents)


def is_blob_url(file_url: str) -> bool:
    return BLOB_HOST_MARKER in urlsplit(file_url).netloc


def resolve_local_file_path(file_url: str) -> Path | None:
    parsed_path = urlsplit(file_url).path or file_url
    if not parsed_path.startswith("/uploads/"):
        return None

    relative_path = Path(parsed_path.removeprefix("/uploads/"))
    destination = (get_upload_dir() / relative_path).resolve()
    upload_root = get_upload_dir().resolve()

    try:
        destination.relative_to(upload_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Đường dẫn tệp tải lên không hợp lệ.") from exc

    return destination


def delete_managed_upload(file_url: Optional[str], *, ignore_missing: bool = True) -> bool:
    if not file_url:
        return False

    local_file_path = resolve_local_file_path(file_url)
    if local_file_path is not None:
        if local_file_path.exists():
            try:
                local_file_path.unlink()
            except PermissionError as exc:
                raise HTTPException(
                    status_code=500,
                    detail="Không thể xóa tệp cục bộ vì tệp đang được hệ thống sử dụng.",
                ) from exc
            return True
        return False

    if not is_blob_url(file_url):
        return False

    try:
        from vercel.blob import delete as delete_blob
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Chưa cài đặt gói Python 'vercel' để xóa file trên Vercel Blob.",
        ) from exc

    if not os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        if ignore_missing:
            return False
        raise HTTPException(
            status_code=503,
            detail="Thiếu BLOB_READ_WRITE_TOKEN để xóa file trên Vercel Blob.",
        )

    try:
        delete_blob(file_url)
        return True
    except Exception as exc:
        error_text = str(exc).lower()
        if ignore_missing and ("not found" in error_text or "404" in error_text):
            return False
        raise HTTPException(
            status_code=502,
            detail=f"Không thể xóa file trên Vercel Blob: {exc}",
        ) from exc


def cleanup_replaced_upload(file_url: Optional[str]) -> None:
    try:
        delete_managed_upload(file_url, ignore_missing=True)
    except HTTPException as exc:
        print(f"Warning: unable to clean up old uploaded file '{file_url}': {exc.detail}")
    except Exception as exc:
        print(f"Warning: unexpected cleanup error for '{file_url}': {exc}")
