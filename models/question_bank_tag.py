from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class QuestionBankTag(SQLModel, table=True):
    """Thẻ/chủ đề gắn cho một câu hỏi trong ngân hàng câu hỏi chung.

    Mỗi câu hỏi có thể có nhiều thẻ; thẻ được chuẩn hóa (bỏ khoảng trắng thừa)
    và so khớp không phân biệt hoa thường khi lọc để giảng viên tìm câu hỏi
    theo chủ đề như "đại số", "cơ sở dữ liệu", "trắc nghiệm"...
    """

    __tablename__ = "question_bank_tag"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_bank_id: int = Field(
        foreign_key="question_bank.id",
        nullable=False,
        index=True,
        description="Câu hỏi trong ngân hàng câu hỏi chung",
    )
    tag: str = Field(
        nullable=False,
        index=True,
        description="Tên thẻ/chủ đề hiển thị (ví dụ: 'Đại số')",
    )
    tag_key: str = Field(
        nullable=False,
        index=True,
        description=(
            "Khóa so khớp không phân biệt hoa thường (casefold), dùng để lọc "
            "thẻ ổn định trên cả PostgreSQL và SQLite"
        ),
    )
