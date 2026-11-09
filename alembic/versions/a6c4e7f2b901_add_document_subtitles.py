"""add document subtitles

Revision ID: a6c4e7f2b901
Revises: f5c2a8d91b73
Create Date: 2026-11-07 10:50:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


revision: str = "a6c4e7f2b901"
down_revision: Union[str, Sequence[str], None] = "f5c2a8d91b73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    if context.is_offline_mode():
        return False
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _has_table("document_subtitle"):
        op.create_table(
            "document_subtitle",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("document_id", sa.Integer(), nullable=False),
            sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=35), nullable=False),
            sa.Column("label", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
            sa.Column("file_url", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("cues_json", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("is_published", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["document.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "document_id",
                "language",
                name="uq_document_subtitle_document_language",
            ),
        )
        op.create_index(
            op.f("ix_document_subtitle_document_id"),
            "document_subtitle",
            ["document_id"],
            unique=False,
        )


def downgrade() -> None:
    if _has_table("document_subtitle"):
        op.drop_index(
            op.f("ix_document_subtitle_document_id"),
            table_name="document_subtitle",
        )
        op.drop_table("document_subtitle")
