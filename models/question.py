from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Question(SQLModel, table=True):
    __tablename__ = "question"

    id: Optional[int] = Field(default=None, primary_key=True)
    exam_id: int = Field(foreign_key="exam.id", nullable=False)
    content: str = Field(default="Noi dung cau hoi", nullable=False)
    question_type: str = Field(default="multiple_choice", nullable=False)
    sequence: int = Field(default=1, nullable=False)
    score: int = Field(
        default=0,
        nullable=False,
        description="Điểm của câu hỏi khi trả lời đúng",
    )
    answer: str = Field(
        default="Câu trả lời",
        nullable=False,
        description="Nội dung câu trả lời đúng",
    )
    bloom_level: str = Field(
        default="remember",
        nullable=False,
        description="Cấp độ Bloom: remember, understand, apply, analyze, evaluate, create",
    )
    difficulty: str = Field(
        default="medium",
        nullable=False,
        description="Mức độ khó: easy, medium, hard",
    )
