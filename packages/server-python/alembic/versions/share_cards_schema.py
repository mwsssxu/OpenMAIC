"""Social share cards tables

Revision ID: share_cards_schema
Revises: video_course_schema
Create Date: 2026-04-17

Tables:
- share_cards: 分享卡片记录表
- share_events: 分享事件追踪表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'share_cards_schema'
down_revision = 'video_course_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Share cards table
    op.create_table(
        'share_cards',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('card_type', sa.String(20), nullable=False),  # 'achievement', 'course_completion', 'passport', 'checkin'
        sa.Column('reference_id', sa.String(100)),  # achievement_id, course_id, etc.
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('subtitle', sa.String(300)),
        sa.Column('image_url', sa.Text()),
        sa.Column('share_url', sa.Text()),
        sa.Column('qr_code_url', sa.Text()),
        sa.Column('style', sa.String(20), server_default='gradient'),
        sa.Column('platform', sa.String(20), server_default='wechat'),
        sa.Column('view_count', sa.Integer(), server_default='0'),
        sa.Column('share_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_share_cards_user', 'share_cards', ['user_id'])
    op.create_index('ix_share_cards_type', 'share_cards', ['card_type'])

    # Share events table (analytics)
    op.create_table(
        'share_events',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('card_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('platform', sa.String(20), nullable=False),  # 'wechat', 'weibo', 'twitter'
        sa.Column('action', sa.String(20), server_default='share'),  # 'share', 'view', 'click'
        sa.Column('referrer', sa.Text()),
        sa.Column('shared_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['card_id'], ['share_cards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_share_events_card', 'share_events', ['card_id'])
    op.create_index('ix_share_events_shared_at', 'share_events', ['shared_at'])


def downgrade():
    op.drop_index('ix_share_events_shared_at', 'share_events')
    op.drop_index('ix_share_events_card', 'share_events')
    op.drop_table('share_events')
    op.drop_index('ix_share_cards_type', 'share_cards')
    op.drop_index('ix_share_cards_user', 'share_cards')
    op.drop_table('share_cards')