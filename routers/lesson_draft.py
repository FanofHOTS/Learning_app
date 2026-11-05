from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy import update
from sqlmodel import Session, select

from database.engine import create_db_engine
from models.course import Course
from models.lesson_draft import LessonDraft
from routers.instructor_auth import get_instructor_id

router = APIRouter(prefix="/lesson-draft", tags=["lesson-draft"])

MAX_CONTENT_BYTES = 1_000_000
DEFAULT_CONTENT: dict[str, Any] = {
    "type": "doc",
    "content": [{"type": "paragraph"}],
}


class LessonDraftCreate(BaseModel):
    title: str = PydanticField(default="Bài giảng chưa có tiêu đề", max_length=200)
    content: dict[str, Any] = DEFAULT_CONTENT
    course_id: Optional[int] = None


class LessonDraftSave(BaseModel):
    title: str = PydanticField(max_length=200)
    content: dict[str, Any]
    version: int = PydanticField(ge=1)


class LessonDraftSummary(BaseModel):
    id: int
    instructor_id: int
    course_id: Optional[int]
    title: str
    version: int
    created_at: datetime
    updated_at: datetime


class LessonDraftRead(LessonDraftSummary):
    content: dict[str, Any]


def get_session():
    with Session(create_db_engine()) as session:
        yield session


def _encode_content(content: dict[str, Any]) -> str:
    if content.get("type") != "doc":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Nội dung phải là tài liệu Tiptap hợp lệ.",
        )
    serialized = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    if len(serialized.encode("utf-8")) > MAX_CONTENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Nội dung bản nháp vượt quá giới hạn 1 MB.",
        )
    return serialized


def _to_read_model(draft: LessonDraft) -> LessonDraftRead:
    try:
        content = json.loads(draft.content_json)
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể đọc nội dung bản nháp đã lưu.",
        ) from error

    if not isinstance(content, dict) or content.get("type") != "doc":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nội dung bản nháp đã lưu không đúng định dạng.",
        )

    return LessonDraftRead(
        id=draft.id,
        instructor_id=draft.instructor_id,
        course_id=draft.course_id,
        title=draft.title,
        content=content,
        version=draft.version,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


def _normalize_title(title: str) -> str:
    normalized = title.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tiêu đề bài giảng không được để trống.",
        )
    if len(normalized) > 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tiêu đề bài giảng không được vượt quá 200 ký tự.",
        )
    return normalized


def _validate_course(
    session: Session,
    course_id: Optional[int],
    instructor_id: int,
) -> None:
    if course_id is None:
        return

    course = session.get(Course, course_id)
    if course is None or course.instructor_id != instructor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khóa học của giảng viên.",
        )


def _get_owned_draft(
    session: Session,
    draft_id: int,
    instructor_id: int,
) -> LessonDraft:
    draft = session.get(LessonDraft, draft_id)
    if draft is None or draft.instructor_id != instructor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bản nháp.",
        )
    return draft


@router.get("/", response_model=list[LessonDraftSummary])
def list_lesson_drafts(
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    drafts = session.exec(
        select(LessonDraft)
        .where(LessonDraft.instructor_id == instructor_id)
        .order_by(LessonDraft.updated_at.desc(), LessonDraft.id.desc())
    ).all()
    return [
        LessonDraftSummary(
            id=draft.id,
            instructor_id=draft.instructor_id,
            course_id=draft.course_id,
            title=draft.title,
            version=draft.version,
            created_at=draft.created_at,
            updated_at=draft.updated_at,
        )
        for draft in drafts
    ]


@router.post(
    "/",
    response_model=LessonDraftRead,
    status_code=status.HTTP_201_CREATED,
)
def create_lesson_draft(
    payload: LessonDraftCreate,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    _validate_course(session, payload.course_id, instructor_id)
    draft = LessonDraft(
        instructor_id=instructor_id,
        course_id=payload.course_id,
        title=_normalize_title(payload.title),
        content_json=_encode_content(payload.content),
    )
    session.add(draft)
    session.commit()
    session.refresh(draft)
    return _to_read_model(draft)


@router.get("/{draft_id}", response_model=LessonDraftRead)
def get_lesson_draft(
    draft_id: int,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    return _to_read_model(_get_owned_draft(session, draft_id, instructor_id))


@router.put("/{draft_id}", response_model=LessonDraftRead)
def update_lesson_draft(
    draft_id: int,
    payload: LessonDraftSave,
    instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    draft = _get_owned_draft(session, draft_id, instructor_id)
    if draft.version != payload.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bản nháp đã được cập nhật ở phiên khác. Hãy tải lại trước khi tiếp tục.",
        )

    result = session.execute(
        update(LessonDraft)
        .where(
            LessonDraft.id == draft_id,
            LessonDraft.instructor_id == instructor_id,
            LessonDraft.version == payload.version,
        )
        .values(
            title=_normalize_title(payload.title),
            content_json=_encode_content(payload.content),
            version=LessonDraft.version + 1,
            updated_at=datetime.now(timezone.utc),
        )
    )
    if result.rowcount != 1:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bản nháp đã được cập nhật ở phiên khác. Hãy tải lại trước khi tiếp tục.",
        )
    session.commit()
    session.refresh(draft)
    session.refresh(draft)
    return _to_read_model(draft)
