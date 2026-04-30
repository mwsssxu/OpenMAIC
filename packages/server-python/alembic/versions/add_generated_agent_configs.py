"""add generated_agent_configs to stages

Revision ID: add_generated_agent_configs
Revises: knowledge_cards_schema
Create Date: 2026-04-29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_generated_agent_configs'
down_revision: Union[str, None] = 'fix_missing_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add generated_agent_configs column to stages table
    op.add_column(
        'stages',
        sa.Column('generated_agent_configs', postgresql.JSONB, nullable=True)
    )


def downgrade() -> None:
    op.drop_column('stages', 'generated_agent_configs')