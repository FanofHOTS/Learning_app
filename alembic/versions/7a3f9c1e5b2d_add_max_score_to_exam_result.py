"""add_max_score_to_exam_result

Revision ID: 7a3f9c1e5b2d
Revises: 54d8f4b2e3c1
Create Date: 2026-07-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "7a3f9c1e5b2d"
down_revision: Union[str, Sequence[str], None] = "832d30d4266d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): theo
# đúng lịch sử ban đầu — DB ở revision trước chưa có cột này.
_OFFLINE_EXISTING_COLUMNS: set[tuple[str, str]] = set()


def _has_column(table_name: str, column_name: str) -> bool:
    """DB hiện tại đã có cột này chưa?

    Cần thiết vì schema khởi tạo `859e46a842f2` đã tạo sẵn
    `exam_result.max_score`, nên trên DB dựng mới hoàn toàn thao tác
    add_column của migration này sẽ lỗi "duplicate column name".
    """
    if context.is_offline_mode():
        return (table_name, column_name) in _OFFLINE_EXISTING_COLUMNS

    inspector = sa.inspect(op.get_bind())
    return column_name in {
        column["name"] for column in inspector.get_columns(table_name)
    }


def upgrade() -> None:
    """Upgrade schema."""
    # Thêm cột max_score (nullable để tương thích với dữ liệu cũ)
    if not _has_column("exam_result", "max_score"):
        op.add_column(
            "exam_result",
            sa.Column("max_score", sa.Integer(), nullable=True),
        )

    # Backfill: gán max_score từ bảng exam cho các dòng đã tồn tại (idempotent,
    # không có dòng NULL thì không thay đổi gì).
    op.execute("""
        UPDATE exam_result
        SET max_score = (
            SELECT COALESCE(exam.max_score, 0)
            FROM exam
            WHERE exam.id = exam_result.exam_id
        )
        WHERE exam_result.max_score IS NULL
    """)


def downgrade() -> None:
    """Downgrade schema."""
    if _has_column("exam_result", "max_score"):
        op.drop_column("exam_result", "max_score")
