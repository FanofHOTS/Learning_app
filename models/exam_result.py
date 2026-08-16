from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ExamResult(SQLModel, table=True):
    __tablename__ = "exam_result"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    exam_id: int = Field(foreign_key="exam.id", nullable=False)
    score: float = Field(nullable=False)
    max_score: int = Field(
        default=0,
        nullable=False,
        description="Tổng điểm tối đa của bài kiểm tra này",
    )
    total_questions: int = Field(nullable=False)
    correct_answers: int = Field(nullable=False)
    is_passed: bool = Field(nullable=False)
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    bloom_breakdown: Optional[str] = Field(
        default=None, nullable=True,
        description='JSON: điểm theo từng mức độ Bloom. V\u00ed d\u1ee5: {"remember": {"correct": 2, "total": 3, "score": 66.7}}',
    )
    difficulty_breakdown: Optional[str] = Field(
        default=None, nullable=True,
        description='JSON: điểm theo từng mức độ khó. V\u00ed d\u1ee5: {"easy": {"correct": 2, "total": 3, "score": 66.7}}',
    )
