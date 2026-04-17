"""Video to Course generation routes

Supports converting YouTube/Bilibili videos into structured courses.

Workflow:
1. Extract video info (title, duration, subtitles)
2. Parse or generate subtitles via ASR
3. AI analyzes content and generates course outline
4. Create course with structured scenes from topics

Revision ID: video_course_schema
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'video_course_schema'
down_revision = 'admin_auth_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Video sources table - track video conversion sources
    op.create_table(
        'video_sources',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('video_url', sa.Text(), nullable=False),
        sa.Column('platform', sa.String(20), nullable=False),  # 'youtube', 'bilibili', 'other'
        sa.Column('video_id', sa.String(100)),  # Platform's video ID
        sa.Column('title', sa.String(500)),
        sa.Column('duration_seconds', sa.Integer()),
        sa.Column('thumbnail_url', sa.Text()),
        sa.Column('language', sa.String(10), server_default='zh-CN'),
        sa.Column('subtitles_available', sa.Boolean(), server_default='false'),
        sa.Column('subtitles_text', sa.Text()),  # Extracted or generated subtitles
        sa.Column('status', sa.String(20), server_default='pending'),  # pending, processing, completed, failed
        sa.Column('error_message', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_video_sources_user', 'video_sources', ['user_id'])
    op.create_index('ix_video_sources_status', 'video_sources', ['status'])

    # Course from video mapping
    op.create_table(
        'course_video_mappings',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('video_source_id', sa.UUID(), nullable=False),
        sa.Column('topic_index', sa.Integer()),  # Which topic in the video maps to which scene
        sa.Column('scene_id', sa.UUID()),
        sa.Column('timestamp_start', sa.Integer()),  # Seconds from video
        sa.Column('timestamp_end', sa.Integer()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['video_source_id'], ['video_sources.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['scene_id'], ['scenes.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_course_video_course', 'course_video_mappings', ['course_id'])


def downgrade():
    op.drop_index('ix_course_video_course', 'course_video_mappings')
    op.drop_table('course_video_mappings')
    op.drop_index('ix_video_sources_status', 'video_sources')
    op.drop_index('ix_video_sources_user', 'video_sources')
    op.drop_table('video_sources')