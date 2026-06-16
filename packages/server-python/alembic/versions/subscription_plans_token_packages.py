"""Add subscription_plans and token_packages tables

These tables are queried by admin_full.py and payment.py but were never
created via alembic. This migration adds them with default data that
matches the pricing defined in app.core.pricing.

Also fixes admin_logs.admin_id FK: was pointing to users.id, should be
admins.id (admins table is created in admin_auth_schema which runs
before this migration in the chain).

Revision ID: subscription_plans_token_packages
Revises: llm_usage_tracking
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'subscription_plans_token_packages'
down_revision = 'llm_usage_tracking'
branch_labels = None
depends_on = None


def upgrade():
    # ============================================================
    # 1. subscription_plans — 订阅计划表
    # ============================================================
    op.create_table(
        'subscription_plans',
        sa.Column('id', sa.String(50), primary_key=True),  # 'pro', 'enterprise', etc.
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price_monthly', sa.Integer(), nullable=False, server_default='0'),   # 分
        sa.Column('price_yearly', sa.Integer(), nullable=False, server_default='0'),     # 分
        sa.Column('days_monthly', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('days_yearly', sa.Integer(), nullable=False, server_default='365'),
        sa.Column('monthly_token_grant', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('features', JSONB(), nullable=True),  # 功能列表
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # 插入默认订阅计划
    # Pro月卡 ¥29.9/月 = 2990分, Pro年卡 ¥299/年 = 29900分
    op.execute("""
        INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, days_monthly, days_yearly, monthly_token_grant, features, active, sort_order) VALUES
        ('pro', 'Pro会员', 2990, 29900, 30, 365, 50,
         '["无限AI问答", "无限讨论模式", "5次/天课程生成", "每月50 Token赠送"]'::jsonb,
         true, 1)
    """)

    # ============================================================
    # 2. token_packages — Token包表
    # ============================================================
    op.create_table(
        'token_packages',
        sa.Column('id', sa.String(50), primary_key=True),  # 'starter', 'learning', 'unlimited'
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price', sa.Integer(), nullable=False, server_default='0'),   # 分
        sa.Column('tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bonus', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # 插入默认Token包
    # 100/¥9.9 = 990分, 500/¥39.9 = 3990分, 2000/¥149 = 14900分
    op.execute("""
        INSERT INTO token_packages (id, name, price, tokens, bonus, active, sort_order) VALUES
        ('starter', '体验包', 990, 100, 0, true, 1),
        ('learning', '学习包', 3990, 450, 50, true, 2),
        ('unlimited', '畅学包', 14900, 1800, 200, true, 3)
    """)

    # ============================================================
    # 3. 修复 admin_logs.admin_id FK: users.id -> admins.id
    # ============================================================
    # 先删除旧FK约束，再添加新的
    # PostgreSQL 自动命名的FK约束格式: admin_logs_admin_id_fkey
    op.drop_constraint('admin_logs_admin_id_fkey', 'admin_logs', type_='foreignkey')
    op.create_foreign_key(
        'admin_logs_admin_id_fkey',
        'admin_logs', 'admins',
        ['admin_id'], ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    # 恢复 admin_logs FK 指向 users
    op.drop_constraint('admin_logs_admin_id_fkey', 'admin_logs', type_='foreignkey')
    op.create_foreign_key(
        'admin_logs_admin_id_fkey',
        'admin_logs', 'users',
        ['admin_id'], ['id'],
        ondelete='CASCADE',
    )

    op.drop_table('token_packages')
    op.drop_table('subscription_plans')
