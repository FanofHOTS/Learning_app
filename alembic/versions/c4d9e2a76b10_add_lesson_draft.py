"""add lesson drafts

Revision ID: c4d9e2a76b10
Revises: e2b7c9d4a1f6
Create Date: 2026-11-05 00:25:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel


revision: str = "c4d9e2a76b10"
down_revision: Union[str, Sequence[str], None] = "e2b7c9d4a1f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OFFLINE_EXISTING_TABLES = {"user", "course"}


def _has_table(table_name: str) -> bool:
    if context.is_offline_mode():
        return table_name in _OFFLINE_EXISTING_TABLES
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _has_table("lesson_draft"):
        op.create_table(
            "lesson_draft",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("instructor_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=True),
            sa.Column(
                "title",
                sqlmodel.sql.sqltypes.AutoString(length=200),
                nullable=False,
            ),
            sa.Column("content_json", sa.Text(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["course_id"], ["course.id"]),
            sa.ForeignKeyConstraint(["instructor_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_lesson_draft_instructor_id"),
            "lesson_draft",
            ["instructor_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_lesson_draft_course_id"),
            "lesson_draft",
            ["course_id"],
            unique=False,
        )


def downgrade() -> None:
    if not _has_table("lesson_draft"):
        return
    op.drop_index(op.f("ix_lesson_draft_course_id"), table_name="lesson_draft")
    op.drop_index(op.f("ix_lesson_draft_instructor_id"), table_name="lesson_draft")
    op.drop_table("lesson_draft")
