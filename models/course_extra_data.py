from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class CourseExtraData(SQLModel, table=True):
    __tablename__ = "course_extra_data"

    course_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="course.id", sa_column_kwargs={'autoincrement': False})
    objective: str = Field(default="Mục tiêu khóa học", nullable=False)
    requirement: str = Field(default="Yêu cầu khóa học", nullable=False)
    required_course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    open_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    close_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    bloom_objectives: str = Field(default="{}", nullable=False)
    assessment_matrix: str = Field(default="{}", nullable=False)
    content_structure: str = Field(default="{}", nullable=False)
