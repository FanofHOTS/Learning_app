"""add question distribution and topic

Bài kiểm tra có thể quy định cấu trúc câu hỏi khi sinh viên làm bài:
- `question_distribution_mode`: none / bloom (theo mức độ nhận thức) / topic (theo chủ đề).
- `question_distribution`: JSON danh sách {"key": ..., "weight": ...} quy định tỷ lệ.

Mỗi câu hỏi có thêm `topic` (chủ đề/từ khóa) để chia nhóm khi dùng chế độ topic.

Migration kiểm tra bảng/cột đã tồn tại chưa trước khi thêm, nên chạy an toàn trên DB
được tạo bằng `create_all` hay DB đã có sẵn cột.

Revision ID: b8d1f4a6c270
Revises: 3c9b7e5d2a41
Create Date: 2026-10-29 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'b8d1f4a6c270'
down_revision: Union[str, Sequence[str], None] = '3c9b7e5d2a41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): DB đang
# ở đúng revision trước đó — chưa có các cột mới.
_OFFLINE_EXISTING_COLUMNS: set[tuple[str, str]] = set()


def _has_table(table_name: str) -> bool:
    if context.is_offline_mode():
        return table_name in {"exam", "question"}

    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    """Bảng hiện tại đã có cột này chưa? (offline dùng trạng thái giả định)."""
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
    if _has_table("exam"):
        if not _has_column("exam", "question_distribution_mode"):
            op.add_column(
                "exam",
                sa.Column(
                    "question_distribution_mode",
                    sqlmodel.sql.sqltypes.AutoString(),
                    nullable=False,
                    server_default="none",
                ),
            )
        if not _has_column("exam", "question_distribution"):
            op.add_column(
                "exam",
                sa.Column(
                    "question_distribution",
                    sqlmodel.sql.sqltypes.AutoString(),
                    nullable=True,
                ),
            )

    if _has_table("question") and not _has_column("question", "topic"):
        op.add_column(
            "question",
            sa.Column(
                "topic",
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=True,
            ),
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_table("question") and _has_column("question", "topic"):
        with op.batch_alter_table("question") as batch_op:
            batch_op.drop_column("topic")

    if _has_table("exam") and _has_column("exam", "question_distribution"):
        with op.batch_alter_table("exam") as batch_op:
            batch_op.drop_column("question_distribution")

    if _has_table("exam") and _has_column("exam", "question_distribution_mode"):
        with op.batch_alter_table("exam") as batch_op:
            batch_op.drop_column("question_distribution_mode")
