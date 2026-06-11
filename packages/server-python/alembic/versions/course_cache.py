"""create course_cache table for semantic matching

Revision ID: course_cache_001
Revises: 
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = 'course_cache_001'
down_revision = None  # Will be set by alembic
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'course_cache',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('source_stage_id', sa.UUID(), nullable=False, index=True),
        sa.Column('requirement_text', sa.Text(), nullable=False),
        sa.Column('embedding', JSONB(), nullable=True),  # 1024-dim vector as JSONB array
        sa.Column('outlines', JSONB(), nullable=True),   # Cached outlines
        sa.Column('scenes_summary', JSONB(), nullable=True),  # [{type, title}]
        sa.Column('language', sa.String(10), nullable=False, server_default='zh-CN'),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    # 索引：按语言查询
    op.create_index('ix_course_cache_language', 'course_cache', ['language'])


def downgrade() -> None:
    op.drop_index('ix_course_cache_language')
    op.drop_table('course_cache')
