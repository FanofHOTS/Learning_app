from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class QuestionBank(SQLModel, table=True):
    """Câu hỏi được đăng lên ngân hàng câu hỏi chung.

    Giảng viên đăng câu hỏi của mình lên đây để giảng viên khác lấy về và
    thêm vào bài kiểm tra của họ (dữ liệu được sao chép, không dùng chung
    bản ghi với bảng `question`).
    """

    __tablename__ = "question_bank"

    id: Optional[int] = Field(default=None, primary_key=True)
    content: str = Field(
        default="Nội dung câu hỏi",
        nullable=False,
        description="Nội dung câu hỏi được chia sẻ",
    )
    question_type: str = Field(
        default="multiple_choice",
        nullable=False,
        description="Loại câu hỏi: multiple_choice, multiple_answer, fill_in_blank, true_false",
    )
    answer: str = Field(
        default="",
        nullable=False,
        description=(
            "Nội dung đáp án đúng; nhiều đáp án hoặc nhiều chỗ trống phân tách bằng ' | ', "
            "các cách viết được chấp nhận của cùng một chỗ trống phân tách bằng '~' "
            "(ví dụ: 'Hà Nội ~ HN | Tokyo')"
        ),
    )
    bloom_level: str = Field(
        default="remember",
        nullable=False,
        description="Cấp độ Bloom: remember, understand, apply, analyze, evaluate, create",
    )
    difficulty: str = Field(
        default="medium",
        nullable=False,
        description="Mức độ khó: easy, medium, hard",
    )
    score: int = Field(
        default=1,
        nullable=False,
        description="Điểm gợi ý khi thêm câu hỏi này vào bài kiểm tra",
    )
    category_id: Optional[int] = Field(
        default=None,
        foreign_key="category.id",
        nullable=True,
        index=True,
        description="Phân loại/môn học của câu hỏi (nếu có)",
    )
    created_by: int = Field(
        foreign_key="user.id",
        nullable=False,
        index=True,
        description="Người đăng câu hỏi lên ngân hàng chung",
    )
    is_active: bool = Field(
        default=True,
        nullable=False,
        description="Câu hỏi còn hiển thị trong ngân hàng chung hay không",
    )
    usage_count: int = Field(
        default=0,
        nullable=False,
        description="Số lần câu hỏi được lấy từ ngân hàng chung và dùng trong bài kiểm tra",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class QuestionBankOption(SQLModel, table=True):
    """Phương án trả lời của một câu hỏi trong ngân hàng câu hỏi chung."""

    __tablename__ = "question_bank_option"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_bank_id: int = Field(
        foreign_key="question_bank.id",
        nullable=False,
        index=True,
        description="Câu hỏi trong ngân hàng câu hỏi chung",
    )
    content: str = Field(
        default="Nội dung lựa chọn",
        nullable=False,
        description="Nội dung phương án trả lời",
    )
    is_correct: bool = Field(default=False, nullable=False)
