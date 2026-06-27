from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Document(SQLModel, table=True):
    __tablename__ = "document"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Học liệu", nullable=False)
    document_type: Optional[str] = Field(default="other", nullable=False)
    content: Optional[str] = Field(default=None, nullable=True)
    file_url: Optional[str] = Field(default="/document/document_test.pdf", nullable=True)
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
