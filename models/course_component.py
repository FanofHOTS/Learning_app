from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class CourseComponent(SQLModel, table=True):
    __tablename__ = "course_component"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="course.id", nullable=False)
    module_id: int = Field(foreign_key="module.id", nullable=False)
    title: str = Field(default="Thành phần học tập", nullable=False)
    component_sequence: int = Field(default=1, nullable=False)
    component_type: str = Field(default="document", nullable=False)
    ref_id: Optional[int] = Field(default=None, nullable=True)
    summary: str = Field(default="Mô tả ngắn cho thành phần học tập", nullable=False)
    estimated_minutes: int = Field(default=15, nullable=False)
    is_preview: bool = Field(default=False, nullable=False)
