"""add exam attempt for autosave

Lưu tạm trạng thái làm bài của sinh viên trên máy chủ:
- `exam_attempt`: lượt làm bài, câu hỏi đã chọn, câu trả lời mới nhất, thời điểm
  bắt đầu và hạn nộp do máy chủ tính, số phiên bản và trạng thái đã nộp/chưa nộp.
- `exam_result.attempt_id` (unique): khóa chống nộp trùng — mỗi lượt làm bài chỉ
  sinh ra tối đa một kết quả.

Migration kiểm tra bảng/cột đã tồn tại chưa trước khi tạo, nên chạy an toàn trên
DB được tạo bằng `create_all` hay DB đã có sẵn cột.

Revision ID: e2b7c9d4a1f6
Revises: b8d1f4a6c270
Create Date: 2026-10-31 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'e2b7c9d4a1f6'
down_revision: Union[str, Sequence[str], None] = 'b8d1f4a6c270'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): DB đang
# ở đúng revision trước đó — chưa có bảng/cột mới.
_OFFLINE_EXISTING_TABLES: set[str] = set()
_OFFLINE_EXISTING_COLUMNS: set[tuple[str, str]] = set()


def _has_table(table_name: str) -> bool:
    if context.is_offline_mode():
        return table_name in _OFFLINE_EXISTING_TABLES

    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    if context.is_offline_mode():
        return (table_name, column_name) in _OFFLINE_EXISTING_COLUMNS

    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return False
    return any(
        column["name"] == column_name
        for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    """Upgrade schema."""
    if not _has_table("exam_attempt"):
        op.create_table(
            'exam_attempt',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('exam_id', sa.Integer(), nullable=False),
            sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('question_ids', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('answers', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('version', sa.Integer(), nullable=False),
            sa.Column('started_at', sa.DateTime(), nullable=False),
            sa.Column('deadline_at', sa.DateTime(), nullable=True),
            sa.Column('last_saved_at', sa.DateTime(), nullable=True),
            sa.Column('submitted_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.ForeignKeyConstraint(['exam_id'], ['exam.id'], ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_exam_attempt_user_id'),
            'exam_attempt',
            ['user_id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_exam_attempt_exam_id'),
            'exam_attempt',
            ['exam_id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_exam_attempt_status'),
            'exam_attempt',
            ['status'],
            unique=False,
        )

    if _has_table("exam_result") and not _has_column("exam_result", "attempt_id"):
        op.add_column(
            "exam_result",
            sa.Column("attempt_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            op.f('ix_exam_result_attempt_id'),
            'exam_result',
            ['attempt_id'],
            unique=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_table("exam_result") and _has_column("exam_result", "attempt_id"):
        op.drop_index(
            op.f('ix_exam_result_attempt_id'), table_name='exam_result'
        )
        with op.batch_alter_table("exam_result") as batch_op:
            batch_op.drop_column("attempt_id")

    if _has_table("exam_attempt"):
        op.drop_index(op.f('ix_exam_attempt_status'), table_name='exam_attempt')
        op.drop_index(op.f('ix_exam_attempt_exam_id'), table_name='exam_attempt')
        op.drop_index(op.f('ix_exam_attempt_user_id'), table_name='exam_attempt')
        op.drop_table('exam_attempt')
