"""Note reminder system tables - 断裂点6修复

Revision ID: note_reminders_schema
Revises: programming_schema
Create Date: 2026-04-17

Tables:
- note_reminders: 课程完成后的笔记提醒表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'note_reminders_schema'
down_revision = 'programming_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'note_reminders',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('template_type', sa.String(50), nullable=False),
        sa.Column('template_sections', sa.Text(), nullable=False),  # JSON
        sa.Column('reward_points', sa.Integer(), nullable=False),
        sa.Column('deadline', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('note_id', sa.UUID()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('skipped_at', sa.DateTime()),
        sa.Column('skip_reason', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
        # note_id 外键将在 notes_schema 之后添加
    )
    op.create_index('ix_note_reminders_user', 'note_reminders', ['user_id'])
    op.create_index('ix_note_reminders_course', 'note_reminders', ['course_id'])
    op.create_index('ix_note_reminders_status', 'note_reminders', ['status'])


def downgrade():
    op.drop_index('ix_note_reminders_status', 'note_reminders')
    op.drop_index('ix_note_reminders_course', 'note_reminders')
    op.drop_index('ix_note_reminders_user', 'note_reminders')
    op.drop_table('note_reminders')