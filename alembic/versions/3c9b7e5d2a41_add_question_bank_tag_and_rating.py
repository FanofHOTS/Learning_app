"""add question bank tag and rating tables

Thêm hai bảng phục vụ ngân hàng câu hỏi chung:
- `question_bank_tag`: thẻ/chủ đề gắn cho từng câu hỏi để lọc nhanh.
- `question_bank_rating`: đánh giá chất lượng 1-5 sao của giảng viên cho câu hỏi.

Migration kiểm tra bảng đã tồn tại trước khi tạo, nên chạy an toàn trên DB đã
có sẵn bảng (ví dụ DB tạo bằng `create_all`) mà không báo "already exists".

Revision ID: 3c9b7e5d2a41
Revises: 494a4bb0774c
Create Date: 2026-10-23 20:40:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '3c9b7e5d2a41'
down_revision: Union[str, Sequence[str], None] = '494a4bb0774c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (offline `--sql`): DB đang ở đúng
# revision trước đó — chưa có hai bảng mới.
_OFFLINE_EXISTING_TABLES: set[str] = set()


def _has_table(table_name: str) -> bool:
    """DB hiện tại đã có bảng này chưa? (offline dùng trạng thái giả định)."""
    if context.is_offline_mode():
        return table_name in _OFFLINE_EXISTING_TABLES

    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


def upgrade() -> None:
    """Upgrade schema."""
    if not _has_table("question_bank_tag"):
        op.create_table(
            'question_bank_tag',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('question_bank_id', sa.Integer(), nullable=False),
            sa.Column('tag', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('tag_key', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.ForeignKeyConstraint(['question_bank_id'], ['question_bank.id'], ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_question_bank_tag_question_bank_id'),
            'question_bank_tag',
            ['question_bank_id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_question_bank_tag_tag'),
            'question_bank_tag',
            ['tag'],
            unique=False,
        )
        op.create_index(
            op.f('ix_question_bank_tag_tag_key'),
            'question_bank_tag',
            ['tag_key'],
            unique=False,
        )

    if not _has_table("question_bank_rating"):
        op.create_table(
            'question_bank_rating',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('question_bank_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('rating', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['question_bank_id'], ['question_bank.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_question_bank_rating_question_bank_id'),
            'question_bank_rating',
            ['question_bank_id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_question_bank_rating_user_id'),
            'question_bank_rating',
            ['user_id'],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_table("question_bank_rating"):
        op.drop_index(
            op.f('ix_question_bank_rating_user_id'),
            table_name='question_bank_rating',
        )
        op.drop_index(
            op.f('ix_question_bank_rating_question_bank_id'),
            table_name='question_bank_rating',
        )
        op.drop_table('question_bank_rating')

    if _has_table("question_bank_tag"):
        op.drop_index(
            op.f('ix_question_bank_tag_tag_key'),
            table_name='question_bank_tag',
        )
        op.drop_index(
            op.f('ix_question_bank_tag_tag'),
            table_name='question_bank_tag',
        )
        op.drop_index(
            op.f('ix_question_bank_tag_question_bank_id'),
            table_name='question_bank_tag',
        )
        op.drop_table('question_bank_tag')
