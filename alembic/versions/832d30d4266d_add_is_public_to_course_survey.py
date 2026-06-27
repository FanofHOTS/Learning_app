"""add is_public and end_at to course_survey

Revision ID: 832d30d4266d
Revises: 54d8f4b2e3c1
Create Date: 2026-04-26 07:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = "832d30d4266d"
down_revision: Union[str, Sequence[str], None] = "54d8f4b2e3c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("course_survey") as batch_op:
        batch_op.add_column(
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )
        batch_op.add_column(
            sa.Column("end_at", sa.DateTime(), nullable=True)
        )
        batch_op.alter_column("course_id", nullable=True, existing_type=sa.Integer())


def downgrade() -> None:
    with op.batch_alter_table("course_survey") as batch_op:
        batch_op.alter_column("course_id", nullable=False, existing_type=sa.Integer())
        batch_op.drop_column("end_at")
        batch_op.drop_column("is_public")
