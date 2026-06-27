from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Option(SQLModel, table=True):
    __tablename__ = "option"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: Optional[int] = Field(default=None, foreign_key="question.id", nullable=False)
    content: str = Field(default="Nội dung lựa chọn", nullable=False)
    is_correct: bool = Field(default=False, nullable=False)
