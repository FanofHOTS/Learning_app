from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Certificate(SQLModel, table=True):
    __tablename__ = "certificate"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=False)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=False)
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    certificate_code: str = Field(
        default="Mã chứng chỉ",
        nullable=False,
        unique=True,
        description="Mã duy nhất của chứng chỉ, có thể được sử dụng để xác minh tính hợp lệ của chứng chỉ.",
    )
    certificate_file: Optional[str] = Field(
        default=None,
        nullable=True,
        description="Đường dẫn đến tệp chứng chỉ. Có thể là tệp PDF hoặc hình ảnh.",
    )
    template_id: Optional[int] = Field(
        default=None,
        nullable=True,
        foreign_key="certificate_template.id",
        description="ID của mẫu chứng chỉ được sử dụng (nếu có).",
    )


class CertificateTemplate(SQLModel, table=True):
    __tablename__ = "certificate_template"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="Mẫu chứng chỉ", nullable=False, description="Tên mẫu chứng chỉ")
    description: Optional[str] = Field(default=None, nullable=True, description="Mô tả mẫu chứng chỉ")
    file_url: Optional[str] = Field(
        default=None,
        nullable=True,
        description="URL của tệp mẫu (hình nền chứng chỉ), có thể là ảnh hoặc PDF.",
    )
    is_active: bool = Field(
        default=False,
        nullable=False,
        description="True nếu đây là mẫu đang được sử dụng làm nền cho chứng chỉ.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
