from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CourseProgress(SQLModel, table=True):
    __tablename__ = "course_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: Optional[int] = Field(default=1, nullable=False, foreign_key="course.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    module_completed: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)
    final_score: int = Field(default=0, nullable=True)
    completed_at: Optional[datetime] = Field(default=None, nullable=True)
