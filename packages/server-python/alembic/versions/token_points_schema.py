"""token_points_schema

Revision ID: token_points
Revises: gamification_schema
Create Date: 2026-04-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'token_points'
down_revision: Union[str, None] = 'gamification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Token账户表
    op.create_table(
        'token_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('balance', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_token_accounts_user_id', 'token_accounts', ['user_id'])

    # 积分账户表
    op.create_table(
        'point_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('balance', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_point_accounts_user_id', 'point_accounts', ['user_id'])

    # Token交易流水表
    op.create_table(
        'token_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('balance_after', sa.Integer, nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_token_transactions_user_id', 'token_transactions', ['user_id'])
    op.create_index('idx_token_transactions_created_at', 'token_transactions', ['created_at'])

    # 积分交易流水表
    op.create_table(
        'point_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('balance_after', sa.Integer, nullable=False),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_point_transactions_user_id', 'point_transactions', ['user_id'])
    op.create_index('idx_point_transactions_created_at', 'point_transactions', ['created_at'])

    # 支付订单表
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('token_amount', sa.Integer, nullable=False),
        sa.Column('payment_method', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), default='created'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_orders_user_id', 'orders', ['user_id'])
    op.create_index('idx_orders_status', 'orders', ['status'])


def downgrade() -> None:
    op.drop_table('orders')
    op.drop_table('point_transactions')
    op.drop_table('token_transactions')
    op.drop_table('point_accounts')
    op.drop_table('token_accounts')