from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class AssignmentSubmitted(SQLModel, table=True):
    __tablename__ = "assignment_submitted"

    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: Optional[int] = Field(default=None, foreign_key="assignment.id", nullable=False)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=False)
    submission_content: Optional[str] = Field(default=None, nullable=True, description="Nội dung bài tập đã nộp. Có thể là văn bản, mã nguồn, hoặc liên kết đến tài liệu.")
    submission_file: Optional[str] = Field(default=None, nullable=True, description="Đường dẫn đến tệp đính kèm của bài tập đã nộp. Có thể là tệp PDF, DOCX, ZIP, v.v.")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    is_graded: bool = Field(default=False, nullable=False, description="Trạng thái chấm điểm của bài tập đã nộp. Nếu là True, bài tập đã được chấm điểm; nếu là False, bài tập chưa được chấm điểm.")
    is_passed: Optional[bool] = Field(default=None, nullable=True, description="Trạng thái đạt hay không đạt của bài tập đã nộp. Nếu là True, bài tập đã đạt; nếu là False, bài tập chưa đạt; nếu là None, bài tập chưa được chấm điểm.")
    is_resubmitted: bool = Field(default=False, nullable=False, description="Trạng thái nộp lại của bài tập đã nộp. Nếu là True, bài tập đã được nộp lại; nếu là False, bài tập chưa được nộp lại.")
    score: Optional[int] = Field(default=None, nullable=True, description="Điểm số của bài tập đã nộp. Chấm điểm thủ công bởi giảng viên.")
    feedback: Optional[str] = Field(default=None, nullable=True, description="Phản hồi của giảng viên về bài tập đã nộp.")
    is_final_submission: bool = Field(default=False, nullable=False, description="Trạng thái nộp cuối cùng của bài tập đã nộp. Nếu là True, đây là lần nộp cuối cùng; nếu là False, sinh viên có thể nộp lại bài tập.")
