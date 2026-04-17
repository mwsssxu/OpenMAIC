"""学习搭子系统数据表迁移

新增表:
- buddy_configs: 搭子配置（类型、触发条件）
- buddy_messages: 搭子消息记录
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'buddy_schema'
down_revision = 'subscriptions_schema'
branch_labels = None
depends_on = 'subscriptions_schema'


def upgrade():
    # 搭子配置表
    op.create_table(
        'buddy_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('buddy_type', sa.String(20), nullable=False),  # 'encourager', 'challenger', 'listener', 'critic', 'scholar', 'partner'
        sa.Column('buddy_name', sa.String(50)),  # 搭子昵称
        sa.Column('buddy_avatar', sa.String(100)),  # 搭子头像URL
        sa.Column('tone_style', sa.String(20)),  # 'warm', 'strict', 'humorous', 'serious'
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_buddy_configs_user', 'buddy_configs', ['user_id'])

    # 搭子消息记录表
    op.create_table(
        'buddy_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trigger_event', sa.String(30), nullable=False),  # 'checkin', 'task_complete', 'miss_checkin', 'inactive'
        sa.Column('message_type', sa.String(20)),  # 'text', 'reminder', 'celebration'
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('read', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_buddy_messages_user', 'buddy_messages', ['user_id'])
    op.create_index('idx_buddy_messages_created', 'buddy_messages', ['created_at'])


def downgrade():
    op.drop_table('buddy_messages')
    op.drop_table('buddy_configs')