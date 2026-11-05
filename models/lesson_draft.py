from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Text
from sqlmodel import Field, SQLModel


class LessonDraft(SQLModel, table=True):
    __tablename__ = "lesson_draft"

    id: Optional[int] = Field(default=None, primary_key=True)
    instructor_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    course_id: Optional[int] = Field(
        default=None,
        foreign_key="course.id",
        nullable=True,
        index=True,
    )
    title: str = Field(default="Bài giảng chưa có tiêu đề", max_length=200, nullable=False)
    content_json: str = Field(sa_type=Text, nullable=False)
    version: int = Field(default=1, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
