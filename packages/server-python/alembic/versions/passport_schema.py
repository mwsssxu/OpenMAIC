"""学习护照系统数据表迁移

新增表:
- learning_passports: 学习护照表
- project_portfolios: 项目作品表
- skill_assessments: 技能评估表
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'passport_schema'
down_revision = 'review_schema'
branch_labels = None
depends_on = 'review_schema'


def upgrade():
    # 学习护照表（技能认证）
    op.create_table(
        'learning_passports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('skill_name', sa.String(100), nullable=False),
        sa.Column('skill_category', sa.String(50)),  # 'programming', 'data', 'business', 'language', 'design'
        sa.Column('skill_level', sa.Integer, default=1),  # 1-5星
        sa.Column('courses_completed', sa.Integer, default=0),
        sa.Column('projects_completed', sa.Integer, default=0),
        sa.Column('total_time_hours', sa.Float, default=0),
        sa.Column('quiz_avg_score', sa.Float),
        sa.Column('review_completion_rate', sa.Float),
        sa.Column('verified', sa.Boolean, default=False),
        sa.Column('verification_hash', sa.String(64)),  # 区块链验证哈希（可选）
        sa.Column('badges', sa.Text),  # 获得的徽章ID列表
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_passports_user', 'learning_passports', ['user_id'])
    op.create_index('idx_passports_skill', 'learning_passports', ['skill_name'])
    op.create_index('idx_passports_category', 'learning_passports', ['skill_category'])
    op.create_unique_constraint('uq_passports_user_skill', 'learning_passports', ['user_id', 'skill_name'])

    # 项目作品表
    op.create_table(
        'project_portfolios',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('stage_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='SET NULL')),
        sa.Column('project_name', sa.String(255), nullable=False),
        sa.Column('project_type', sa.String(50)),  # 'code', 'document', 'presentation', 'video', 'other'
        sa.Column('description', sa.Text),
        sa.Column('content_url', sa.Text),  # 作品链接
        sa.Column('thumbnail_url', sa.Text),  # 预览图
        sa.Column('tags', sa.Text),  # 技术标签
        sa.Column('rating', sa.Integer),  # AI评分或用户自评 1-5
        sa.Column('ai_feedback', sa.Text),  # AI评价反馈
        sa.Column('is_public', sa.Boolean, default=True),
        sa.Column('view_count', sa.Integer, default=0),
        sa.Column('like_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_portfolios_user', 'project_portfolios', ['user_id'])
    op.create_index('idx_portfolios_public', 'project_portfolios', ['is_public'])

    # 技能评估表
    op.create_table(
        'skill_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('skill_name', sa.String(100), nullable=False),
        sa.Column('assessment_type', sa.String(20)),  # 'quiz', 'project', 'peer_review', 'ai_evaluation'
        sa.Column('score', sa.Float, nullable=False),  # 0-100
        sa.Column('level_before', sa.Integer),  # 评估前等级
        sa.Column('level_after', sa.Integer),  # 评估后等级
        sa.Column('passed', sa.Boolean, default=False),
        sa.Column('details', sa.Text),  # JSON格式的详细评估结果
        sa.Column('assessed_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_assessments_user', 'skill_assessments', ['user_id'])
    op.create_index('idx_assessments_skill', 'skill_assessments', ['skill_name'])


def downgrade():
    op.drop_table('skill_assessments')
    op.drop_table('project_portfolios')
    op.drop_table('learning_passports')