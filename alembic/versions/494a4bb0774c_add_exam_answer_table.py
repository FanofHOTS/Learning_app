"""add exam answer table

Thêm bảng `exam_answer` để lưu câu trả lời thực tế của sinh viên cho từng câu
hỏi lúc nộp bài. Nhờ đó backend tự chấm được từ dữ liệu trả lời (thay vì tin
cờ `is_correct` do client gửi) và có dữ liệu để đối chiếu, chấm lại, thống kê
sau này.

Migration có kiểm tra bảng đã tồn tại chưa trước khi tạo, nên chạy an toàn trên
DB đã có sẵn bảng (ví dụ DB được tạo bằng `create_all`) mà không báo lỗi
"table already exists".

Revision ID: 494a4bb0774c
Revises: d26460ed5576
Create Date: 2026-10-16 13:18:46.266571

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '494a4bb0774c'
down_revision: Union[str, Sequence[str], None] = 'd26460ed5576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): DB đang
# ở đúng revision trước đó — chưa có bảng exam_answer.
_OFFLINE_EXISTING_TABLES: set[str] = set()


def _has_table(table_name: str) -> bool:
    """DB hiện tại đã có bảng này chưa? (offline dùng trạng thái giả định)."""
    if context.is_offline_mode():
        return table_name in _OFFLINE_EXISTING_TABLES

    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


def upgrade() -> None:
    """Upgrade schema."""
    if _has_table("exam_answer"):
        return

    op.create_table(
        'exam_answer',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('exam_result_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('answer_text', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('option_ids', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['exam_result_id'], ['exam_result.id'], ),
        sa.ForeignKeyConstraint(['question_id'], ['question.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_exam_answer_exam_result_id'),
        'exam_answer',
        ['exam_result_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_exam_answer_question_id'),
        'exam_answer',
        ['question_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    if not _has_table("exam_answer"):
        return

    op.drop_index(
        op.f('ix_exam_answer_question_id'), table_name='exam_answer'
    )
    op.drop_index(
        op.f('ix_exam_answer_exam_result_id'), table_name='exam_answer'
    )
    op.drop_table('exam_answer')
