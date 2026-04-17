"""Learning Assessment System tables - 断裂点4修复

Revision ID: assessments_schema
Revises: note_reminders_schema
Create Date: 2026-04-17

Tables:
- learning_assessments: 学习效果测评表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'assessments_schema'
down_revision = 'note_reminders_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'learning_assessments',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('assessment_type', sa.String(20), nullable=False),  # 'quick', 'standard', 'deep'
        sa.Column('questions', sa.Text(), nullable=False),  # JSON array
        sa.Column('answers', sa.Text()),  # JSON array
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),  # 'pending', 'completed', 'expired'
        sa.Column('score', sa.Float()),
        sa.Column('mastery_level', sa.String(20)),  # '精通', '熟练', '掌握', '了解', '需复习'
        sa.Column('passed', sa.Boolean(), server_default='false'),
        sa.Column('correct_count', sa.Integer()),
        sa.Column('time_spent_minutes', sa.Integer()),
        sa.Column('recommendations', sa.Text()),  # JSON array
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_learning_assessments_user', 'learning_assessments', ['user_id'])
    op.create_index('ix_learning_assessments_course', 'learning_assessments', ['course_id'])
    op.create_index('ix_learning_assessments_status', 'learning_assessments', ['status'])


def downgrade():
    op.drop_index('ix_learning_assessments_status', 'learning_assessments')
    op.drop_index('ix_learning_assessments_course', 'learning_assessments')
    op.drop_index('ix_learning_assessments_user', 'learning_assessments')
    op.drop_table('learning_assessments')