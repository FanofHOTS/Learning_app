from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field as PydanticField, field_validator, model_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from database.engine import create_db_engine
from models.course import Course
from services.storage import (
    BASE_DIR,
    VIDEO_EXTENSIONS,
    build_upload_relative_path,
    cleanup_replaced_upload,
    delete_managed_upload,
    get_file_extension,
    get_storage_backend,
    guess_content_type,
    normalize_filename,
    upload_to_blob,
    upload_to_local_storage,
    upload_to_minio,
)

from models.document import Document
from models.document_subtitle import DocumentSubtitle
from models.module import Module
from routers.instructor_auth import get_instructor_id
from services.document_cleanup import delete_document_summaries_and_subtitles

router = APIRouter(prefix="/document", tags=["document"])

DEFAULT_DOCUMENT_URL = "/document/document_test.pdf"

class SubtitleCuePayload(BaseModel):
    start: float = PydanticField(ge=0, allow_inf_nan=False)
    end: float = PydanticField(gt=0, allow_inf_nan=False)
    text: str = PydanticField(min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Nội dung phụ đề không được để trống.")
        return normalized

    @model_validator(mode="after")
    def validate_time_range(self):
        if not math.isfinite(self.start) or not math.isfinite(self.end):
            raise ValueError("Mốc thời gian phụ đề phải là số hữu hạn.")
        if self.end <= self.start:
            raise ValueError("Thời điểm kết thúc phải sau thời điểm bắt đầu.")
        if round(self.end * 1000) <= round(self.start * 1000):
            raise ValueError("Mỗi đoạn phụ đề phải dài ít nhất một mili giây.")
        return self


class SubtitleSavePayload(BaseModel):
    subtitle_id: Optional[int] = PydanticField(default=None, gt=0)
    language: str = PydanticField(
        min_length=2,
        max_length=35,
        pattern=r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$",
    )
    label: str = PydanticField(min_length=1, max_length=80)
    cues: list[SubtitleCuePayload] = PydanticField(max_length=5000)
    is_published: bool = False

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Tên ngôn ngữ phụ đề không được để trống.")
        return normalized

    @model_validator(mode="after")
    def validate_published_cues(self):
        if self.is_published and not self.cues:
            raise ValueError("Hãy thêm ít nhất một đoạn trước khi xuất bản phụ đề.")
        return self


def get_session():
    with Session(create_db_engine()) as session:
        yield session


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


def _get_owned_subtitle_document(
    session: Session,
    document_id: int,
    instructor_id: int,
) -> Document:
    document = session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    course_id = document.course_id
    if course_id is None and document.module_id is not None:
        module = session.get(Module, document.module_id)
        course_id = module.course_id if module is not None else None

    course = session.get(Course, course_id) if course_id is not None else None
    if course is None or course.instructor_id != instructor_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu của giảng viên.")
    if document.document_type != "video":
        raise HTTPException(status_code=422, detail="Chỉ video mới hỗ trợ phụ đề.")
    return document


def _format_vtt_time(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}.{milliseconds:03}"


def _build_webvtt(cues: list[SubtitleCuePayload]) -> bytes:
    ordered_cues = sorted(cues, key=lambda cue: (cue.start, cue.end))
    lines = ["WEBVTT", ""]
    for index, cue in enumerate(ordered_cues, start=1):
        text = cue.text.replace("\r\n", "\n").replace("\r", "\n")
        lines.extend(
            [
                str(index),
                f"{_format_vtt_time(cue.start)} --> {_format_vtt_time(cue.end)}",
                text,
                "",
            ]
        )
    return ("\n".join(lines) + "\n").encode("utf-8")


def _subtitle_response(subtitle: DocumentSubtitle) -> dict:
    return {
        "id": subtitle.id,
        "document_id": subtitle.document_id,
        "language": subtitle.language,
        "label": subtitle.label,
        "file_url": subtitle.file_url,
        "cues": json.loads(subtitle.cues_json),
        "is_published": subtitle.is_published,
        "created_at": subtitle.created_at,
        "updated_at": subtitle.updated_at,
    }


def _store_subtitle_file(document_id: int, language: str, content: bytes) -> str:
    relative_path = build_upload_relative_path(
        "subtitles",
        f"document-{document_id}-{language.lower()}.vtt",
    )
    backend = get_storage_backend("DOCUMENT_STORAGE_BACKEND")
    if backend == "blob":
        return upload_to_blob(relative_path.as_posix(), content, "text/vtt; charset=utf-8")
    if backend == "minio":
        return upload_to_minio(relative_path.as_posix(), content, "text/vtt; charset=utf-8")
    return upload_to_local_storage(relative_path, content)


@router.get("/{document_id}/subtitles")
def get_published_document_subtitles(
    document_id: int,
    session: Session = Depends(get_session),
):
    if session.get(Document, document_id) is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    subtitles = session.exec(
        select(DocumentSubtitle)
        .where(
            DocumentSubtitle.document_id == document_id,
            DocumentSubtitle.is_published.is_(True),
        )
        .order_by(DocumentSubtitle.language)
    ).all()
    return [
        {
            "id": subtitle.id,
            "document_id": subtitle.document_id,
            "language": subtitle.language,
            "label": subtitle.label,
            "file_url": subtitle.file_url,
            "is_published": subtitle.is_published,
        }
        for subtitle in subtitles
    ]


@router.get("/{document_id}/subtitles/manage")
def get_manageable_document_subtitles(
    document_id: int,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    document = _get_owned_subtitle_document(session, document_id, instructor_id)
    subtitles = session.exec(
        select(DocumentSubtitle)
        .where(DocumentSubtitle.document_id == document.id)
        .order_by(DocumentSubtitle.language)
    ).all()
    return [_subtitle_response(subtitle) for subtitle in subtitles]


@router.put("/{document_id}/subtitles")
def save_document_subtitle(
    document_id: int,
    payload: SubtitleSavePayload,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    document = _get_owned_subtitle_document(session, document_id, instructor_id)
    subtitle = None
    if payload.subtitle_id is not None:
        subtitle = session.get(DocumentSubtitle, payload.subtitle_id)
        if subtitle is None or subtitle.document_id != document_id:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản phụ đề.")
    else:
        subtitle = session.exec(
            select(DocumentSubtitle).where(
                DocumentSubtitle.document_id == document_id,
                DocumentSubtitle.language == payload.language,
            )
        ).first()

    old_file_url = subtitle.file_url if subtitle is not None else None
    file_url = _store_subtitle_file(
        document_id,
        payload.language,
        _build_webvtt(payload.cues),
    )
    now = datetime.now(timezone.utc)
    if subtitle is None:
        subtitle = DocumentSubtitle(
            document_id=document_id,
            language=payload.language,
            label=payload.label,
            file_url=file_url,
            cues_json=json.dumps(
                [cue.model_dump() for cue in payload.cues],
                ensure_ascii=False,
            ),
            is_published=payload.is_published,
            created_at=now,
            updated_at=now,
        )
        session.add(subtitle)
    else:
        subtitle.language = payload.language
        subtitle.label = payload.label
        subtitle.file_url = file_url
        subtitle.cues_json = json.dumps(
            [cue.model_dump() for cue in payload.cues],
            ensure_ascii=False,
        )
        subtitle.is_published = payload.is_published
        subtitle.updated_at = now

    try:
        session.commit()
        session.refresh(subtitle)
    except IntegrityError as error:
        session.rollback()
        cleanup_replaced_upload(file_url)
        raise HTTPException(
            status_code=409,
            detail="Đã có phụ đề cho ngôn ngữ này. Hãy tải lại danh sách rồi thử lại.",
        ) from error
    except Exception:
        session.rollback()
        cleanup_replaced_upload(file_url)
        raise

    if old_file_url and old_file_url != file_url:
        cleanup_replaced_upload(old_file_url)
    return _subtitle_response(subtitle)


@router.delete("/{document_id}/subtitles")
def delete_document_subtitle(
    document_id: int,
    subtitle_id: int,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    _get_owned_subtitle_document(session, document_id, instructor_id)
    subtitle = session.get(DocumentSubtitle, subtitle_id)
    if subtitle is None or subtitle.document_id != document_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản phụ đề.")

    file_url = subtitle.file_url
    session.delete(subtitle)
    session.commit()
    cleanup_replaced_upload(file_url)
    return {"message": "Đã xóa phụ đề."}


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
        backend = get_storage_backend("DOCUMENT_STORAGE_BACKEND")
        if backend == "blob":
            file_url = upload_to_blob(relative_path.as_posix(), contents, content_type)
        elif backend == "minio":
            file_url = upload_to_minio(relative_path.as_posix(), contents, content_type)
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
    old_document_type = document.document_type
    update_data = document_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(document, key, value)

    now = datetime.now(timezone.utc)
    if old_file_url != document.file_url or old_document_type != document.document_type:
        subtitles = session.exec(
            select(DocumentSubtitle).where(
                DocumentSubtitle.document_id == document_id,
                DocumentSubtitle.is_published.is_(True),
            )
        ).all()
        for subtitle in subtitles:
            subtitle.is_published = False
            subtitle.updated_at = now

    document.updated_at = now
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
    #if document.course_id:
    #    raise HTTPException(status_code=400, detail="Không thể xóa tài liệu đang được sử dụng trong khóa học")
    #if document.module_id:
    #    raise HTTPException(status_code=400, detail="Không thể xóa tài liệu đang được sử dụng trong module khóa học")

    file_url = document.file_url
    subtitle_urls = delete_document_summaries_and_subtitles(session, document_id)
    session.delete(document)
    session.commit()
    cleanup_replaced_upload(file_url)
    for subtitle_url in subtitle_urls:
        cleanup_replaced_upload(subtitle_url)
    return {"message": "Xóa tài liệu thành công"}
