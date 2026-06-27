from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Assignment(SQLModel, table=True):
    __tablename__ = "assignment"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Bài tập mới", nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    assignment_type: str = Field(default="Bài tập trắc nghiệm", nullable=False, description="Loại bài tập. Ví dụ: Bài tập trắc nghiệm, Bài tập tự luận, Bài tập lập trình, v.v.")
    assignment_content: Optional[str] = Field(default=None, nullable=True, description="Nội dung bài tập. Có thể là văn bản, mã nguồn, hoặc liên kết đến tài liệu.")
    assignment_file: Optional[str] = Field(default=None, nullable=True, description="Đường dẫn đến tệp đính kèm của bài tập. Có thể là tệp PDF, DOCX, ZIP, v.v.")
    is_active: bool = Field(default=False, nullable=False)
    pass_score: int = Field(default=50, nullable=False, description="Điểm tối thiểu để đạt bài tập này")
    max_score: int = Field(default=100, nullable=False, description="Điểm tối đa của bài tập này")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
