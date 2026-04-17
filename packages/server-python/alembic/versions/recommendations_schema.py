"""课程推荐系统数据表迁移

新增表:
- course_recommendations: 课程推荐关系表
- course_completions: 课程完成记录表
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'recommendations_schema'
down_revision = 'gamification_schema'
branch_labels = None
depends_on = 'gamification_schema'


def upgrade():
    # 课程推荐关系表
    op.create_table(
        'course_recommendations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('source_course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('target_course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('recommendation_type', sa.String(20), nullable=False),  # 'advanced', 'related', 'project', 'review'
        sa.Column('weight', sa.Float, default=1.0),
        sa.Column('reason', sa.Text),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_recommendations_source', 'course_recommendations', ['source_course_id'])
    op.create_index('idx_recommendations_target', 'course_recommendations', ['target_course_id'])
    op.create_index('idx_recommendations_type', 'course_recommendations', ['recommendation_type'])

    # 课程完成记录表
    op.create_table(
        'course_completions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('completed_at', sa.DateTime, nullable=False),
        sa.Column('completion_status', sa.String(20), default='completed'),  # 'completed', 'partial', 'reviewed'
        sa.Column('rating', sa.Integer),  # 用户评分 1-5
        sa.Column('notes', sa.Text),  # 学习笔记
        sa.Column('scenes_completed', sa.Integer, default=0),
        sa.Column('total_scenes', sa.Integer, default=0),
        sa.Column('time_spent_minutes', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_completions_user', 'course_completions', ['user_id'])
    op.create_index('idx_completions_course', 'course_completions', ['course_id'])
    op.create_unique_constraint('uq_completions_user_course', 'course_completions', ['user_id', 'course_id'])

    # 用户学习路径表
    op.create_table(
        'learning_paths',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('path_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('course_ids', sa.Text),  # 课程ID列表，逗号分隔
        sa.Column('status', sa.String(20), default='active'),  # 'active', 'completed', 'abandoned'
        sa.Column('progress', sa.Integer, default=0),  # 完成百分比
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_paths_user', 'learning_paths', ['user_id'])


def downgrade():
    op.drop_table('learning_paths')
    op.drop_table('course_completions')
    op.drop_table('course_recommendations')