"""add_max_score_to_exam_result

Revision ID: 7a3f9c1e5b2d
Revises: 54d8f4b2e3c1
Create Date: 2026-07-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "7a3f9c1e5b2d"
down_revision: Union[str, Sequence[str], None] = "832d30d4266d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Thêm cột max_score (nullable để tương thích với dữ liệu cũ)
    op.add_column(
        "exam_result",
        sa.Column("max_score", sa.Integer(), nullable=True),
    )

    # Backfill: gán max_score từ bảng exam cho các dòng đã tồn tại
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
    op.drop_column("exam_result", "max_score")
