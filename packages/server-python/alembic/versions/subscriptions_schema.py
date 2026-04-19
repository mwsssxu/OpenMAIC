"""会员订阅系统数据表迁移

新增表:
- subscriptions: 会员订阅状态
- subscription_usage: 权益使用记录
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'subscriptions_schema'
down_revision = 'buddy_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 会员订阅表
    op.create_table(
        'subscriptions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_type', sa.String(20), nullable=False),  # 'free', 'premium', 'enterprise'
        sa.Column('status', sa.String(20), nullable=False),  # 'active', 'trial', 'expired', 'cancelled'
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('auto_renew', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_subscriptions_user', 'subscriptions', ['user_id'])
    op.create_index('idx_subscriptions_expires', 'subscriptions', ['expires_at'])
    op.create_unique_constraint('uq_subscriptions_user', 'subscriptions', ['user_id'])

    # 会员权益使用记录表
    op.create_table(
        'subscription_usage',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('feature', sa.String(50), nullable=False),  # 'course_generation', 'collaboration', etc.
        sa.Column('usage_count', sa.Integer, default=0),
        sa.Column('reset_at', sa.DateTime),  # 每日/每月重置时间
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_subscription_usage_user', 'subscription_usage', ['user_id'])
    op.create_index('idx_subscription_usage_reset', 'subscription_usage', ['reset_at'])
    op.create_unique_constraint('uq_subscription_usage_user_feature', 'subscription_usage', ['user_id', 'feature'])


def downgrade():
    op.drop_table('subscription_usage')
    op.drop_table('subscriptions')