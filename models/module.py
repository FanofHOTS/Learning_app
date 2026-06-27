from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Module(SQLModel, table=True):
    __tablename__ = "module"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: Optional[int] = Field(default=1, foreign_key="course.id", nullable=False)
    title: str = Field(default="Tên module khóa học", nullable=False)
    module_sequence: int = Field(default=0, nullable=False)
    type: str = Field(default="Học liệu", nullable=False)
    introduction: str = Field(default="Giới thiệu module khóa học", nullable=False)
    total_component: int = Field(default=0, nullable=False)
