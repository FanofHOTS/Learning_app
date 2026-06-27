from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ModuleProgress(SQLModel, table=True):
    __tablename__ = "module_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: Optional[int] = Field(default=1, nullable=False, foreign_key="course.id")
    module_id: Optional[int] = Field(default=1, nullable=False, foreign_key="module.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    components_completed: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)
    completed_at: Optional[datetime] = Field(default=None, nullable=True)
