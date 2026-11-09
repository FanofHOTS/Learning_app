from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class DocumentSubtitle(SQLModel, table=True):
    __tablename__ = "document_subtitle"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "language",
            name="uq_document_subtitle_document_language",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", nullable=False, index=True)
    language: str = Field(max_length=35, nullable=False)
    label: str = Field(max_length=80, nullable=False)
    file_url: str = Field(nullable=False)
    cues_json: str = Field(nullable=False)
    is_published: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
