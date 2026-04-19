"""学习匹配系统数据表迁移

新增表:
- matching_preferences: 用户匹配偏好设置
- learning_matches: 学习匹配记录
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'matching_schema'
down_revision = 'enterprise_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 用户匹配偏好表
    op.create_table(
        'matching_preferences',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('goal_tags', sa.Text),  # 学习目标标签，逗号分隔
        sa.Column('course_ids', sa.Text),  # 关注的课程ID列表
        sa.Column('progress_level', sa.String(20)),  # beginner, intermediate, advanced
        sa.Column('schedule_preference', sa.String(20)),  # morning, afternoon, evening, flexible
        sa.Column('match_mode', sa.String(20), default='auto'),  # auto, manual
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_matching_prefs_user', 'matching_preferences', ['user_id'])

    # 学习匹配记录表
    op.create_table(
        'learning_matches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id_1', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id_2', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('match_type', sa.String(20), default='study'),  # study, discussion, review
        sa.Column('match_score', sa.Float, default=0),  # 匹配度分数
        sa.Column('common_courses', sa.Text),  # 共同课程ID列表
        sa.Column('common_tags', sa.Text),  # 共同学习目标标签
        sa.Column('status', sa.String(20), default='pending'),  # pending, accepted, rejected, expired
        sa.Column('expires_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_learning_matches_user1', 'learning_matches', ['user_id_1'])
    op.create_index('idx_learning_matches_user2', 'learning_matches', ['user_id_2'])
    op.create_index('idx_learning_matches_status', 'learning_matches', ['status'])
    op.create_unique_constraint('uq_learning_matches_users', 'learning_matches', ['user_id_1', 'user_id_2'])


def downgrade():
    op.drop_table('learning_matches')
    op.drop_table('matching_preferences')