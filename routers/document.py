from __future__ import annotations

import mimetypes
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Field, SQLModel, Session, select

from database.engine import create_db_engine

router = APIRouter(prefix="/document", tags=["document"])

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_UPLOAD_DIR = BASE_DIR / "uploads"
DEFAULT_DOCUMENT_URL = "/document/document_test.pdf"
BLOB_HOST_MARKER = ".blob.vercel-storage.com"
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg"}


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class Document(SQLModel, table=True):
    __tablename__ = "document"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Học liệu", nullable=False)
    document_type: Optional[str] = Field(default="other", nullable=False)
    content: Optional[str] = Field(default=None, nullable=True)
    file_url: Optional[str] = Field(default=DEFAULT_DOCUMENT_URL, nullable=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def get_upload_dir() -> Path:
    configured_path = os.getenv("UPLOAD_DIR", "").strip()
    if not configured_path:
        return DEFAULT_UPLOAD_DIR

    upload_dir = Path(configured_path)
    if upload_dir.is_absolute():
        return upload_dir

    return BASE_DIR / upload_dir


def get_storage_backend() -> str:
    configured_backend = os.getenv("DOCUMENT_STORAGE_BACKEND", "auto").strip().lower()
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


def validate_file_matches_document_type(document_type: str, filename: str) -> None:
    extension = get_file_extension(filename)

    if document_type == "pdf" and extension != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Vui lòng tải lên tệp PDF cho loại tài liệu PDF.",
        )

    if document_type == "video" and extension not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Vui lòng tải lên tệp video (.mp4, .webm, .ogg) cho loại tài liệu video.",
        )


def build_upload_relative_path(filename: str) -> Path:
    timestamp = datetime.now(timezone.utc)
    return (
        Path("documents")
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
                "Hãy cấu hình BLOB_READ_WRITE_TOKEN hoặc DOCUMENT_STORAGE_BACKEND=blob."
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


@router.get("/", response_model=List[Document])
def get_all_documents(session: Session = Depends(get_session)):
    return session.exec(select(Document)).all()


@router.get("/course/{course_id}", response_model=List[Document])
def get_documents_by_course(course_id: int, session: Session = Depends(get_session)):
    documents = session.exec(select(Document).where(Document.course_id == course_id)).all()
    if not documents:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu cho khóa học này")
    return documents


@router.get("/module/{module_id}", response_model=List[Document])
def get_documents_by_module(module_id: int, session: Session = Depends(get_session)):
    documents = session.exec(
        select(Document).where(Document.module_id == module_id)
    ).all()
    if not documents:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu cho module này")
    return documents


@router.get("/{document_id}", response_model=Document)
def get_document(document_id: int, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return document


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Tên tệp không hợp lệ, không có tên tệp hoặc không có tệp.",
        )

    filename = normalize_filename(file.filename)
    validate_file_matches_document_type(document_type, filename)

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Tệp tải lên đang rỗng.")

    relative_path = build_upload_relative_path(filename)
    content_type = guess_content_type(filename, file)

    try:
        if get_storage_backend() == "blob":
            file_url = upload_to_blob(relative_path.as_posix(), contents, content_type)
        else:
            file_url = upload_to_local_storage(relative_path, contents)
    finally:
        await file.close()

    return {"file_url": file_url}


@router.post("/delete_upload")
async def delete_uploaded_file(file_url: str):
    deleted = delete_managed_upload(file_url, ignore_missing=True)
    if deleted:
        return {"message": "Tệp đã được xóa thành công."}
    return {"message": "Không có tệp được quản lý nào cần xóa."}


@router.post("/create", response_model=Document)
def create_document(document: Document, session: Session = Depends(get_session)):
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.put("/update/{document_id}", response_model=Document)
def update_document(
    document_id: int, document_data: Document, session: Session = Depends(get_session)
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    old_file_url = document.file_url
    update_data = document_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(document, key, value)

    document.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(document)

    if update_data.get("file_url") and update_data["file_url"] != old_file_url:
        cleanup_replaced_upload(old_file_url)

    return document


@router.delete("/delete/{document_id}", response_model=dict)
def delete_document(document_id: int, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    # Kiểm tra xem tài liệu có đang được sử dụng trong khóa học nào không, nếu có thì không cho phép xóa
    if document.course_id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài liệu đang được sử dụng trong khóa học")
    if document.module_id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài liệu đang được sử dụng trong module khóa học")

    file_url = document.file_url
    session.delete(document)
    session.commit()
    cleanup_replaced_upload(file_url)
    return {"message": "Xóa tài liệu thành công"}
