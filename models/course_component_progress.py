from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CourseComponentProgress(SQLModel, table=True):
    __tablename__ = "course_component_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    course_id: int = Field(foreign_key="course.id", nullable=False)
    module_id: int = Field(foreign_key="module.id", nullable=False)
    course_component_id: int = Field(
        foreign_key="course_component.id", nullable=False
    )
    is_completed: bool = Field(default=False, nullable=False)
    completed_at: Optional[datetime] = Field(default=None, nullable=True)
