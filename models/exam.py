from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Exam(SQLModel, table=True):
    __tablename__ = "exam"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Bài thi mới", nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    duration_minutes: int = Field(default=30, nullable=False)
    total_questions: int = Field(default=10, nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    pass_score: int = Field(default=50, nullable=False, description="Điểm tối thiểu để đạt bài kiểm tra này")
    max_score: int = Field(default=100, nullable=False, description="Điểm tối đa của bài kiểm tra này")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
