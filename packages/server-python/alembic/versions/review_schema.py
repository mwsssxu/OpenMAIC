"""间隔重复复习系统数据表迁移

新增表:
- review_schedules: 复习计划表
- review_records: 复习记录表
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'review_schema'
down_revision = 'recommendations_schema'
branch_labels = None
depends_on = 'recommendations_schema'


def upgrade():
    # 复习计划表（基于艾宾浩斯遗忘曲线）
    op.create_table(
        'review_schedules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('scene_id', UUID(as_uuid=True), sa.ForeignKey('scenes.id', ondelete='CASCADE')),  # 可选：特定场景复习
        sa.Column('review_type', sa.String(20), nullable=False),  # 'quick_recall', 'key_points', 'deep_review', 'comprehensive'
        sa.Column('trigger_at', sa.DateTime, nullable=False),  # 触发时间
        sa.Column('duration_minutes', sa.Integer, default=5),  # 预计复习时长
        sa.Column('status', sa.String(20), default='pending'),  # 'pending', 'completed', 'skipped', 'expired'
        sa.Column('priority', sa.Integer, default=1),  # 优先级 1-5
        sa.Column('content_preview', sa.Text),  # 复习内容预览
        sa.Column('completed_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_review_schedules_user', 'review_schedules', ['user_id'])
    op.create_index('idx_review_schedules_trigger', 'review_schedules', ['trigger_at'])
    op.create_index('idx_review_schedules_status', 'review_schedules', ['status'])

    # 复习记录表
    op.create_table(
        'review_records',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('schedule_id', UUID(as_uuid=True), sa.ForeignKey('review_schedules.id', ondelete='CASCADE')),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('review_type', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('completed_at', sa.DateTime),
        sa.Column('time_spent_minutes', sa.Integer, default=0),
        sa.Column('effectiveness_rating', sa.Integer),  # 用户自评效果 1-5
        sa.Column('quiz_score', sa.Integer),  # 复习测验得分
        sa.Column('notes', sa.Text),  # 复习笔记
        sa.Column('next_review_at', sa.DateTime),  # 下次复习时间（用户选择提前/延后）
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_review_records_user', 'review_records', ['user_id'])
    op.create_index('idx_review_records_course', 'review_records', ['course_id'])


def downgrade():
    op.drop_table('review_records')
    op.drop_table('review_schedules')