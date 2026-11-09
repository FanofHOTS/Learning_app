"""Lưu bản tóm tắt AI của tài liệu vào cơ sở dữ liệu.

Bảng `document_summary` giữ tối đa một bản tóm tắt cho mỗi cặp
(tài liệu, mức độ dài). Nhờ vậy bản tóm tắt vẫn còn sau khi khởi động lại máy
chủ và không phải gọi lại AI; `source_fingerprint` giúp phát hiện tài liệu đã
thay đổi để tạo bản mới.

Migration kiểm tra bảng đã tồn tại chưa trước khi tạo, nên chạy an toàn trên
DB được tạo bằng `create_all`.

Revision ID: f5c2a8d91b73
Revises: c4d9e2a76b10
Create Date: 2026-11-05 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'f5c2a8d91b73'
down_revision: Union[str, Sequence[str], None] = 'c4d9e2a76b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): chưa có bảng mới.
_OFFLINE_EXISTING_TABLES: set[str] = set()


def _has_table(table_name: str) -> bool:
    if context.is_offline_mode():
        return table_name in _OFFLINE_EXISTING_TABLES

    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


def upgrade() -> None:
    """Upgrade schema."""
    if not _has_table("document_summary"):
        op.create_table(
            'document_summary',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('document_id', sa.Integer(), nullable=False),
            sa.Column('length_mode', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('overview', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('key_points', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('keywords', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('model_used', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('source_fingerprint', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['document_id'], ['document.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint(
                'document_id',
                'length_mode',
                name='uq_document_summary_document_length',
            ),
        )
        op.create_index(
            op.f('ix_document_summary_document_id'),
            'document_summary',
            ['document_id'],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_table("document_summary"):
        op.drop_index(
            op.f('ix_document_summary_document_id'),
            table_name='document_summary',
        )
        op.drop_table('document_summary')
