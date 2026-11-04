from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ExamAttempt(SQLModel, table=True):
    """Một lượt làm bài kiểm tra đang được lưu tạm trên máy chủ.

    Bản ghi này là nguồn sự thật cho:
    - thời gian bắt đầu và hạn nộp (do máy chủ tính), nên tải lại trang không
      làm đồng hồ đếm ngược chạy lại từ đầu;
    - danh sách câu hỏi đã chọn cho lượt làm bài (để lần quay lại thấy đúng đề);
    - câu trả lời mới nhất (JSON) của sinh viên, kèm số phiên bản và thời điểm
      lưu để client biết bản lưu nào mới hơn.

    `answers` là JSON danh sách
    [{"question_id": 1, "answer_text": "...", "option_ids": [2], "is_correct": false}]
    theo đúng cấu trúc câu trả lời của API nộp bài.
    """

    __tablename__ = "exam_attempt"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    exam_id: int = Field(foreign_key="exam.id", nullable=False, index=True)
    status: str = Field(
        default="in_progress",
        nullable=False,
        index=True,
        description="in_progress (đang làm) hoặc submitted (đã nộp, không ghi đè nữa)",
    )
    question_ids: Optional[str] = Field(
        default=None,
        nullable=True,
        description="JSON array id các câu hỏi đã chọn cho lượt làm bài này",
    )
    answers: Optional[str] = Field(
        default=None,
        nullable=True,
        description="JSON array câu trả lời đã lưu tạm gần nhất của sinh viên",
    )
    version: int = Field(
        default=0,
        nullable=False,
        description="Tăng sau mỗi lần lưu tạm để đối chiếu bản lưu mới nhất",
    )
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        description="Thời điểm bắt đầu làm bài do máy chủ ghi nhận",
    )
    deadline_at: Optional[datetime] = Field(
        default=None,
        nullable=True,
        description="Hạn nộp do máy chủ tính từ started_at + thời lượng bài kiểm tra",
    )
    last_saved_at: Optional[datetime] = Field(default=None, nullable=True)
    submitted_at: Optional[datetime] = Field(default=None, nullable=True)
