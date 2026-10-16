from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class ExamAnswer(SQLModel, table=True):
    """Câu trả lời thực tế của sinh viên cho từng câu hỏi của bài thi.

    Được ghi lại lúc nộp bài để có thể đối chiếu, chấm lại và thống kê về sau.
    Nhờ vậy điểm số không còn phụ thuộc duy nhất vào cờ `is_correct` do client
    gửi lên: backend tự chấm từ `answer_text`/`option_ids` khi có dữ liệu, và
    chỉ rơi về cờ cũ đối với client chưa gửi câu trả lời thật.

    `answer_text` dùng cho câu điền chỗ trống: các chỗ trống phân tách bằng
    ' | ', các cách viết được chấp nhận của cùng một chỗ trống phân tách bằng
    '~' ở phía đáp án (đáp án nằm ở bảng `question`, không lưu lại ở đây).
    """

    __tablename__ = "exam_answer"

    id: Optional[int] = Field(default=None, primary_key=True)
    exam_result_id: int = Field(
        foreign_key="exam_result.id",
        nullable=False,
        index=True,
        description="Kết quả bài thi mà câu trả lời này thuộc về",
    )
    question_id: int = Field(
        foreign_key="question.id",
        nullable=False,
        index=True,
        description="Câu hỏi sinh viên đã trả lời",
    )
    answer_text: Optional[str] = Field(
        default=None,
        nullable=True,
        description=(
            "Nội dung sinh viên nhập (câu điền chỗ trống: các chỗ trống phân tách bằng ' | ')"
        ),
    )
    option_ids: Optional[str] = Field(
        default=None,
        nullable=True,
        description="JSON array id các phương án sinh viên chọn (câu trắc nghiệm)",
    )
    is_correct: bool = Field(
        default=False,
        nullable=False,
        description="Kết quả chấm do backend quyết định (client không được ghi đè)",
    )
