from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Field, SQLModel, Session, select

from database.engine import create_db_engine
from services.storage import (
    BASE_DIR,
    VIDEO_EXTENSIONS,
    build_upload_relative_path,
    cleanup_replaced_upload,
    delete_managed_upload,
    ensure_local_upload_destination,
    get_file_extension,
    get_upload_dir,
    guess_content_type,
    is_blob_url,
    is_running_on_vercel,
    normalize_filename,
    resolve_local_file_path,
    upload_to_blob,
    upload_to_local_storage,
)

from models.document import Document

router = APIRouter(prefix="/document", tags=["document"])

DEFAULT_DOCUMENT_URL = "/document/document_test.pdf"


def get_session():
    with Session(create_db_engine()) as session:
        yield session


def get_storage_backend() -> str:
    """Document-specific storage backend that can be configured independently."""
    configured_backend = os.getenv("DOCUMENT_STORAGE_BACKEND", "auto").strip().lower()
    if configured_backend not in {"auto", "local", "blob"}:
        configured_backend = "auto"

    if configured_backend == "blob":
        return "blob"
    if configured_backend == "local":
        return "local"

    return "blob" if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip() else "local"


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


def build_document_relative_path(filename: str) -> Path:
    return build_upload_relative_path("documents", filename)


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

    relative_path = build_document_relative_path(filename)
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
    if document.module_id:

    file_url = document.file_url
    session.delete(document)
    session.commit()
    cleanup_replaced_upload(file_url)
    return {"message": "Xóa tài liệu thành công"}
