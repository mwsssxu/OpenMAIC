"""add gamification tables

Revision ID: gamification
Revises: initial
Create Date: 2026-04-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'gamification'
down_revision: Union[str, None] = 'initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 扩展用户表（添加打卡字段）
    op.add_column('users', sa.Column('current_streak', sa.Integer, default=0))
    op.add_column('users', sa.Column('max_streak', sa.Integer, default=0))
    op.add_column('users', sa.Column('total_points', sa.Integer, default=0))

    # 2. 每日打卡表
    op.create_table(
        'daily_checkins',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('checkin_date', sa.Date, nullable=False),
        sa.Column('streak_count', sa.Integer, default=1),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_checkins_user_id', 'daily_checkins', ['user_id'])
    op.create_index('idx_checkins_date', 'daily_checkins', ['checkin_date'])
    op.create_unique_constraint('uq_checkin_user_date', 'daily_checkins', ['user_id', 'checkin_date'])

    # 3. 成就表
    op.create_table(
        'user_achievements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('achievement_id', sa.String(50), nullable=False),
        sa.Column('progress', sa.Integer, default=0),
        sa.Column('earned_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_achievements_user_id', 'user_achievements', ['user_id'])
    op.create_unique_constraint('uq_achievement_user_ach', 'user_achievements', ['user_id', 'achievement_id'])

    # 4. 分享课程表
    op.create_table(
        'shared_classrooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('stage_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('share_code', sa.String(10), unique=True, nullable=False),
        sa.Column('is_public', sa.Boolean, default=True),
        sa.Column('title', sa.String(255)),
        sa.Column('description', sa.Text),
        sa.Column('view_count', sa.Integer, default=0),
        sa.Column('like_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_shared_user_id', 'shared_classrooms', ['user_id'])
    op.create_index('idx_shared_code', 'shared_classrooms', ['share_code'])

    # 5. 课程点赞表
    op.create_table(
        'classroom_likes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('shared_classroom_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('shared_classrooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_likes_user_id', 'classroom_likes', ['user_id'])
    op.create_unique_constraint('uq_like_user_classroom', 'classroom_likes', ['shared_classroom_id', 'user_id'])

    # 6. 学习记录表（用于统计）
    op.create_table(
        'learning_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stage_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE')),
        sa.Column('scene_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scenes.id', ondelete='CASCADE')),
        sa.Column('action_type', sa.String(50)),  # 'view', 'complete', 'quiz', 'chat', 'whiteboard'
        sa.Column('duration_seconds', sa.Integer),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_records_user_id', 'learning_records', ['user_id'])
    op.create_index('idx_records_date', 'learning_records', ['created_at'])


def downgrade() -> None:
    op.drop_table('learning_records')
    op.drop_table('classroom_likes')
    op.drop_table('shared_classrooms')
    op.drop_table('user_achievements')
    op.drop_table('daily_checkins')
    op.drop_column('users', 'total_points')
    op.drop_column('users', 'max_streak')
    op.drop_column('users', 'current_streak')