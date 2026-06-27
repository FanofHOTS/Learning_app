from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Course(SQLModel, table=True):
    __tablename__ = "course"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Tên khóa học", nullable=False)
    category_id: Optional[int] = Field(default=1, foreign_key="category.id", nullable=False)
    category_name: Optional[str] = Field(default=None, nullable=True)
    instructor_id: Optional[int] = Field(default=1, foreign_key="user.id", nullable=False)
    instructor_name: Optional[str] = Field(default=None, nullable=True)
    introduction: str = Field(default="Giới thiệu khóa học", nullable=False)
    description: str = Field(default="Mô tả khóa học", nullable=False)
    level: str = Field(default="Cơ Bản", nullable=False)
    total_module: int = Field(default=1, nullable=False)
    total_student: int = Field(default=0, nullable=False)
    image: str = Field(default="/logo.png", nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    is_public: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
