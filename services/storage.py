from __future__ import annotations

import mimetypes
import os
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional
from urllib.parse import quote, unquote, urlsplit
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


def get_storage_backend(setting: str = "STORAGE_BACKEND") -> str:
    configured_backend = os.getenv(setting, "auto").strip().lower()
    if configured_backend not in {"auto", "local", "blob", "minio"}:
        configured_backend = "auto"

    if configured_backend == "blob":
        return "blob"
    if configured_backend == "minio":
        return "minio"
    if configured_backend == "local":
        return "local"

    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        return "blob"
    if os.getenv("MINIO_ENDPOINT", "").strip():
        return "minio"
    return "local"


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
                "Hãy cấu hình BLOB_READ_WRITE_TOKEN hoặc STORAGE_BACKEND=blob/minio."
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
        from vercel.blob import sync as blob
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Chưa cài đặt gói Python 'vercel-blob' để upload lên Vercel Blob.",
        ) from exc

    if not os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        raise HTTPException(
            status_code=503,
            detail="Thiếu BLOB_READ_WRITE_TOKEN để upload file lên Vercel Blob.",
        )

    try:
        result = blob.put_blob(
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

    return result.url


def _get_minio_public_url() -> str:
    endpoint = os.getenv("MINIO_ENDPOINT", "").strip()
    public_url = os.getenv("MINIO_PUBLIC_URL", "").strip() or endpoint
    if not public_url:
        return ""

    parsed_url = urlsplit(public_url if "://" in public_url else f"http://{public_url}")
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise HTTPException(
            status_code=503,
            detail="MINIO_PUBLIC_URL phải là URL gốc có scheme http hoặc https.",
        )
    return parsed_url.geturl().rstrip("/")


def _get_minio_config() -> tuple[str, str, str, bool, str]:
    endpoint = os.getenv("MINIO_ENDPOINT", "").strip()
    access_key = os.getenv("MINIO_ACCESS_KEY", "").strip()
    secret_key = os.getenv("MINIO_SECRET_KEY", "").strip()
    bucket = os.getenv("MINIO_BUCKET", "learning-app-uploads").strip()
    public_url = _get_minio_public_url()

    if not endpoint or not access_key or not secret_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Cần cấu hình MINIO_ENDPOINT, MINIO_ACCESS_KEY và "
                "MINIO_SECRET_KEY để sử dụng MinIO."
            ),
        )
    if not bucket or not public_url:
        raise HTTPException(
            status_code=503,
            detail="Cần cấu hình MINIO_BUCKET và MINIO_PUBLIC_URL hợp lệ.",
        )

    parsed_endpoint = urlsplit(endpoint if "://" in endpoint else f"http://{endpoint}")
    if not parsed_endpoint.netloc or parsed_endpoint.path not in {"", "/"}:
        raise HTTPException(
            status_code=503,
            detail="MINIO_ENDPOINT phải là host:port hoặc URL gốc của MinIO.",
        )

    secure_value = os.getenv("MINIO_SECURE", "").strip().lower()
    secure = secure_value in {"1", "true", "yes", "on"} if secure_value else parsed_endpoint.scheme == "https"
    return parsed_endpoint.netloc, access_key, secret_key, secure, bucket


def _create_minio_client():
    try:
        from minio import Minio
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Chưa cài đặt gói Python 'minio' để sử dụng MinIO.",
        ) from exc

    endpoint, access_key, secret_key, secure, _ = _get_minio_config()
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def _ensure_minio_bucket(client, bucket: str) -> None:
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    except Exception:
        if not client.bucket_exists(bucket):
            raise


def upload_to_minio(pathname: str, contents: bytes, content_type: str) -> str:
    client = _create_minio_client()
    _, _, _, _, bucket = _get_minio_config()
    public_url = _get_minio_public_url()

    try:
        _ensure_minio_bucket(client, bucket)
        client.put_object(
            bucket,
            pathname,
            BytesIO(contents),
            length=len(contents),
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Không thể lưu file lên MinIO: {exc}",
        ) from exc

    return f"{public_url}/{quote(bucket)}/{quote(pathname, safe='/')}"


def upload_to_local_storage(relative_path: Path, contents: bytes) -> str:
    destination = ensure_local_upload_destination(relative_path)
    destination.write_bytes(contents)
    return f"/uploads/{relative_path.as_posix()}"


def store_file(relative_path: Path, contents: bytes, content_type: str) -> str:
    """Store a file using the active local, Vercel Blob, or MinIO backend."""
    backend = get_storage_backend()
    if backend == "blob":
        return upload_to_blob(relative_path.as_posix(), contents, content_type)
    if backend == "minio":
        return upload_to_minio(relative_path.as_posix(), contents, content_type)
    return upload_to_local_storage(relative_path, contents)


def is_blob_url(file_url: str) -> bool:
    return BLOB_HOST_MARKER in urlsplit(file_url).netloc


def _minio_object_key(file_url: str) -> str | None:
    public_url = _get_minio_public_url()
    bucket = os.getenv("MINIO_BUCKET", "learning-app-uploads").strip()
    if not public_url or not bucket:
        return None

    parsed_url = urlsplit(file_url)
    parsed_public_url = urlsplit(public_url if "://" in public_url else f"http://{public_url}")
    expected_path_prefix = f"{parsed_public_url.path.rstrip('/')}/{quote(bucket)}/"
    if (
        parsed_url.scheme != parsed_public_url.scheme
        or parsed_url.netloc != parsed_public_url.netloc
        or not parsed_url.path.startswith(expected_path_prefix)
    ):
        return None

    object_key = unquote(parsed_url.path[len(expected_path_prefix):])
    return object_key or None


def is_minio_url(file_url: str) -> bool:
    return _minio_object_key(file_url) is not None


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

    if is_minio_url(file_url):
        client = _create_minio_client()
        _, _, _, _, bucket = _get_minio_config()
        object_key = _minio_object_key(file_url)
        if object_key is None:
            return False
        try:
            client.remove_object(bucket, object_key)
            return True
        except Exception as exc:
            error_text = str(exc).lower()
            if ignore_missing and ("not found" in error_text or "nosuchkey" in error_text):
                return False
            raise HTTPException(
                status_code=502,
                detail=f"Không thể xóa file khỏi MinIO: {exc}",
            ) from exc

    if not is_blob_url(file_url):
        return False

    try:
        from vercel.blob import sync as blob
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Chưa cài đặt gói Python 'vercel-blob' để xóa file trên Vercel Blob.",
        ) from exc

    if not os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        if ignore_missing:
            return False
        raise HTTPException(
            status_code=503,
            detail="Thiếu BLOB_READ_WRITE_TOKEN để xóa file trên Vercel Blob.",
        )

    try:
        blob.delete_blob(file_url)
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
