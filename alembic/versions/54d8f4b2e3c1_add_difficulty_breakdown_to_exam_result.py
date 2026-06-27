"""add_difficulty_breakdown_to_exam_result

Revision ID: 54d8f4b2e3c1
Revises: 906309e9eb1d
Create Date: 2026-06-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '54d8f4b2e3c1'
down_revision: Union[str, Sequence[str], None] = '906309e9eb1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('exam_result', sa.Column('difficulty_breakdown', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('exam_result', 'difficulty_breakdown')
