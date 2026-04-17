"""Learning depth levels tables

Revision ID: depth_levels_schema
Revises: personas_schema
Create Date: 2026-04-17

Tables:
- depth_progress: 学习深度进度追踪表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'depth_levels_schema'
down_revision = 'personas_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Depth progress table
    op.create_table(
        'depth_progress',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('depth', sa.String(20), nullable=False),  # 'skim', 'understand', 'master'
        sa.Column('scenes_completed', sa.Integer(), server_default='0'),
        sa.Column('total_scenes', sa.Integer()),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'course_id'),
    )
    op.create_index('ix_depth_progress_user', 'depth_progress', ['user_id'])
    op.create_index('ix_depth_progress_course', 'depth_progress', ['course_id'])
    op.create_index('ix_depth_progress_depth', 'depth_progress', ['depth'])


def downgrade():
    op.drop_index('ix_depth_progress_depth', 'depth_progress')
    op.drop_index('ix_depth_progress_course', 'depth_progress')
    op.drop_index('ix_depth_progress_user', 'depth_progress')
    op.drop_table('depth_progress')