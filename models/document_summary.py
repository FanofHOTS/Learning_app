from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class DocumentSummary(SQLModel, table=True):
    """Bản tóm tắt AI đã lưu cho một tài liệu, theo từng mức độ dài."""

    __tablename__ = "document_summary"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "length_mode",
            name="uq_document_summary_document_length",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(
        foreign_key="document.id",
        nullable=False,
        index=True,
    )
    length_mode: str = Field(
        default="medium",
        nullable=False,
        description="Mức độ dài của bản tóm tắt: short, medium hoặc detailed",
    )
    overview: str = Field(
        default="",
        nullable=False,
        description="Đoạn tổng quan về nội dung tài liệu",
    )
    key_points: str = Field(
        default="[]",
        nullable=False,
        description="JSON danh sách các ý chính",
    )
    keywords: str = Field(
        default="[]",
        nullable=False,
        description="JSON danh sách từ khóa quan trọng",
    )
    model_used: str = Field(default="", nullable=False)
    source_fingerprint: str = Field(
        default="",
        nullable=False,
        description="Băm nội dung tài liệu lúc tạo bản tóm tắt để phát hiện thay đổi",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
