"""支付系统数据表迁移

新增表:
- payment_callbacks: 支付回调记录
- 完善 orders 表字段
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'payment_schema'
down_revision = 'invitation_schema'
branch_labels = None
depends_on = 'invitation_schema'


def upgrade():
    # 添加 orders 表字段
    op.add_column('orders', sa.Column('transaction_id', sa.String(64)))  # 第三方支付交易号
    op.add_column('orders', sa.Column('paid_at', sa.DateTime))  # 支付完成时间
    op.add_column('orders', sa.Column('notify_data', sa.Text))  # 回调原始数据

    # 支付回调记录表
    op.create_table(
        'payment_callbacks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('order_id', UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(20), nullable=False),  # wechat, alipay
        sa.Column('transaction_id', sa.String(64)),  # 第三方交易号
        sa.Column('amount', sa.Integer),  # 支付金额（分）
        sa.Column('status', sa.String(20)),  # success, failed
        sa.Column('raw_data', sa.Text),  # 回调原始数据
        sa.Column('processed', sa.Boolean, default=False),  # 是否已处理
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('ix_payment_callbacks_order_id', 'payment_callbacks', ['order_id'])
    op.create_index('ix_payment_callbacks_transaction_id', 'payment_callbacks', ['transaction_id'])


def downgrade():
    op.drop_table('payment_callbacks')
    op.drop_column('orders', 'notify_data')
    op.drop_column('orders', 'paid_at')
    op.drop_column('orders', 'transaction_id')