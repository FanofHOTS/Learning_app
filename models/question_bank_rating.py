from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class QuestionBankRating(SQLModel, table=True):
    """Đánh giá chất lượng (1-5 sao) của giảng viên cho câu hỏi ngân hàng chung.

    Mỗi giảng viên chỉ có tối đa một đánh giá cho mỗi câu hỏi; đánh giá lại sẽ
    cập nhật bản ghi cũ. Điểm trung bình và số lượt đánh giá được tính khi đọc
    danh sách/chi tiết, không lưu trùng để tránh lệch dữ liệu.
    """

    __tablename__ = "question_bank_rating"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_bank_id: int = Field(
        foreign_key="question_bank.id",
        nullable=False,
        index=True,
        description="Câu hỏi được đánh giá",
    )
    user_id: int = Field(
        foreign_key="user.id",
        nullable=False,
        index=True,
        description="Giảng viên đánh giá",
    )
    rating: int = Field(
        nullable=False,
        description="Số sao chất lượng từ 1 đến 5",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
