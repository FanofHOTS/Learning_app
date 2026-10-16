"""repair schema drift for course.is_public and exam_result.max_score

Sửa 2 chỗ lệch schema có sẵn giữa model và DB:

1. `course.is_public`: model `Course` đã có trường này nhưng chưa từng có
   migration tạo cột, nên DB dựng bằng migration sẽ thiếu cột.
2. `exam_result.max_score`: migration `7a3f9c1e5b2d` tạo cột ở dạng nullable
   trong khi model yêu cầu NOT NULL.

Migration có kiểm tra trạng thái thật của DB trước khi thao tác, nên chạy được
an toàn trên cả DB đã có sẵn cột (ví dụ DB được tạo bằng `create_all` hoặc đã
thêm cột thủ công) lẫn DB còn thiếu.

Revision ID: d26460ed5576
Revises: bb5b254e277e
Create Date: 2026-10-13 17:52:50.511498

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'd26460ed5576'
down_revision: Union[str, Sequence[str], None] = 'bb5b254e277e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Trạng thái schema giả định khi chỉ sinh SQL (chế độ offline `--sql`): DB đang
# ở đúng revision trước đó (bb5b254e277e) — chưa có course.is_public, còn
# exam_result.max_score thì đã tồn tại ở dạng nullable.
_OFFLINE_EXISTING_COLUMNS = {("exam_result", "max_score")}
_OFFLINE_NULLABLE_COLUMNS = {("exam_result", "max_score")}


def _has_column(table_name: str, column_name: str) -> bool:
    """DB hiện tại đã có cột này chưa?

    Chế độ offline không soi được DB nên dùng trạng thái giả định ở trên.
    """
    if context.is_offline_mode():
        return (table_name, column_name) in _OFFLINE_EXISTING_COLUMNS

    inspector = sa.inspect(op.get_bind())
    return column_name in {
        column["name"] for column in inspector.get_columns(table_name)
    }


def _is_nullable(table_name: str, column_name: str) -> bool:
    """Cột hiện tại có cho phép NULL không (mặc định True nếu không tìm thấy)."""
    if context.is_offline_mode():
        return (table_name, column_name) in _OFFLINE_NULLABLE_COLUMNS

    inspector = sa.inspect(op.get_bind())
    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return bool(column["nullable"])
    return True


def upgrade() -> None:
    """Upgrade schema."""
    # ── 1. course.is_public ──────────────────────────────────────────────
    # NOT NULL + server_default để dữ liệu cũ nhận giá trị false giống model.
    if not _has_column("course", "is_public"):
        with op.batch_alter_table("course") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "is_public",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("false"),
                )
            )

    # ── 2. exam_result.max_score ─────────────────────────────────────────
    if _has_column("exam_result", "max_score") and _is_nullable(
        "exam_result", "max_score"
    ):
        # Backfill trước khi đặt NOT NULL: lấy theo exam.max_score, còn lại là 0
        # (giống cách migration 7a3f9c1e5b2d đã làm và default của model).
        op.execute(
            """
            UPDATE exam_result
            SET max_score = COALESCE(
                (SELECT COALESCE(exam.max_score, 0) FROM exam WHERE exam.id = exam_result.exam_id),
                0
            )
            WHERE max_score IS NULL
            """
        )
        with op.batch_alter_table("exam_result") as batch_op:
            batch_op.alter_column(
                "max_score",
                existing_type=sa.Integer(),
                nullable=False,
            )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_column("exam_result", "max_score") and not _is_nullable(
        "exam_result", "max_score"
    ):
        with op.batch_alter_table("exam_result") as batch_op:
            batch_op.alter_column(
                "max_score",
                existing_type=sa.Integer(),
                nullable=True,
            )

    if _has_column("course", "is_public"):
        with op.batch_alter_table("course") as batch_op:
            batch_op.drop_column("is_public")
