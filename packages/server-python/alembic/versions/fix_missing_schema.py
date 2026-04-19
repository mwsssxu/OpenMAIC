"""修复数据库schema缺失问题

Revision ID: fix_missing_schema
Revises: classroom_sessions
Create Date: 2026-04-04

修复内容:
- orders表添加transaction_id、paid_at、notify_data列
- 创建daily_task_progress表（游戏化任务进度）
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision: str = 'fix_missing_schema'
down_revision: Union[str, None] = 'classroom_sessions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. orders表添加缺失的列
    op.add_column('orders', sa.Column('transaction_id', sa.String(64), nullable=True))
    op.add_column('orders', sa.Column('paid_at', sa.DateTime, nullable=True))
    op.add_column('orders', sa.Column('notify_data', sa.Text, nullable=True))
    
    # 2. 创建daily_task_progress表（游戏化任务进度）
    op.create_table(
        'daily_task_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_id', sa.String(50), nullable=False),  # 任务标识
        sa.Column('task_date', sa.Date, nullable=False),  # 任务日期
        sa.Column('progress', sa.Integer, default=0),  # 进度
        sa.Column('completed', sa.Boolean, default=False),  # 是否完成
        sa.Column('completed_at', sa.DateTime, nullable=True),  # 完成时间
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_task_progress_user_id', 'daily_task_progress', ['user_id'])
    op.create_index('idx_task_progress_task_id', 'daily_task_progress', ['task_id'])
    op.create_index('idx_task_progress_date', 'daily_task_progress', ['task_date'])
    op.create_unique_constraint('uq_task_progress_user_task', 'daily_task_progress', ['user_id', 'task_id', 'task_date'])


def downgrade() -> None:
    op.drop_table('daily_task_progress')
    op.drop_column('orders', 'notify_data')
    op.drop_column('orders', 'paid_at')
    op.drop_column('orders', 'transaction_id')