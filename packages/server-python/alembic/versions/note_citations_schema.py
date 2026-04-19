"""Note Citations tables - 断裂点5修复

Revision ID: note_citations_schema
Revises: assessments_schema
Create Date: 2026-04-17

Tables:
- note_citations: 笔记引用课程内容表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'note_citations_schema'
down_revision = 'assessments_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'note_citations',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('note_id', sa.UUID(), nullable=False),
        sa.Column('scene_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('content_snippet', sa.Text(), nullable=False),
        sa.Column('citation_type', sa.String(20), server_default='direct'),  # direct, paraphrase, summary
        sa.Column('position_start', sa.Integer()),
        sa.Column('position_end', sa.Integer()),
        sa.Column('context', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        # shared_notes 外键将在 notes_schema 之后添加
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_note_citations_note', 'note_citations', ['note_id'])
    op.create_index('ix_note_citations_scene', 'note_citations', ['scene_id'])
    op.create_index('ix_note_citations_course', 'note_citations', ['course_id'])
    op.create_unique_constraint('uq_note_scene', 'note_citations', ['note_id', 'scene_id'])

    # 添加场景引用计数列
    op.add_column('scenes', sa.Column('citation_count', sa.Integer(), server_default='0'))


def downgrade():
    op.drop_column('scenes', 'citation_count')
    op.drop_constraint('uq_note_scene', 'note_citations')
    op.drop_index('ix_note_citations_course', 'note_citations')
    op.drop_index('ix_note_citations_scene', 'note_citations')
    op.drop_index('ix_note_citations_note', 'note_citations')
    op.drop_table('note_citations')