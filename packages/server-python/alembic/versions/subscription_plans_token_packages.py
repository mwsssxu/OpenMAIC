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
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price_monthly', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('price_yearly', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('days_monthly', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('days_yearly', sa.Integer(), nullable=False, server_default='365'),
        sa.Column('monthly_token_grant', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('features', JSONB(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # 插入默认订阅计划 — 价格必须与 app.core.pricing.PLAN_PRICES 完全一致
    # Pro月卡 ¥19/月 = 1900分, Pro年卡 ¥190/年 = 19000分
    op.execute("""
        INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, days_monthly, days_yearly, monthly_token_grant, features, active, sort_order)
        VALUES ('pro', 'Pro会员', 1900, 19000, 30, 365, 50,
         '{"ai_interaction": "unlimited", "discussion": "unlimited", "course_generation": "5/day", "token_grant": "50/month"}'::jsonb,
         true, 1)
        ON CONFLICT (id) DO NOTHING
    """)

    # ============================================================
    # 2. token_packages — Token包表
    # ============================================================
    op.create_table(
        'token_packages',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bonus', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )

    # 插入默认Token包 — 价格必须与 app.core.pricing.TOKEN_PACKAGES 完全一致
    # starter: ¥6 = 600分, 50 Token
    # learning: ¥18 = 1800分, 180+20 = 200 Token
    # unlimited: ¥48 = 4800分, 500+100 = 600 Token
    op.execute("""
        INSERT INTO token_packages (id, name, price, tokens, bonus, active, sort_order) VALUES
        ('starter', '体验包', 600, 50, 0, true, 1),
        ('learning', '学习包', 1800, 180, 20, true, 2),
        ('unlimited', '畅学包', 4800, 500, 100, true, 3)
        ON CONFLICT (id) DO NOTHING
    """)

    # ============================================================
    # 3. 修复 admin_logs.admin_id FK: users.id -> admins.id
    # ============================================================
    # 先清理孤儿数据：删除 admin_id 不在 admins 表中的记录
    op.execute("DELETE FROM admin_logs WHERE admin_id NOT IN (SELECT id FROM admins)")
    # 使用 IF EXISTS 防止约束名不一致时失败
    op.execute("ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey")
    op.create_foreign_key(
        'admin_logs_admin_id_fkey',
        'admin_logs', 'admins',
        ['admin_id'], ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    # 恢复 admin_logs FK 指向 users
    # 先清理不兼容数据
    op.execute("DELETE FROM admin_logs WHERE admin_id NOT IN (SELECT id FROM users)")
    op.execute("ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey")
    op.create_foreign_key(
        'admin_logs_admin_id_fkey',
        'admin_logs', 'users',
        ['admin_id'], ['id'],
        ondelete='CASCADE',
    )

    # 警告：drop_table 会删除所有运营修改的数据
    op.drop_table('token_packages')
    op.drop_table('subscription_plans')
