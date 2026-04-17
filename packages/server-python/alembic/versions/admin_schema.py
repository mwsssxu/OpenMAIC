"""Admin system tables for management backend

Revision ID: admin_schema
Revises: passport_schema
Create Date: 2026-04-17

Tables:
- admin_logs: 操作日志表
- llm_configs: LLM配置表
- pricing_configs: 价格配置表
- reward_rules: 积分奖励规则表
- review_reward_configs: 复习奖励配置表
- system_settings: 系统设置表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'admin_schema'
down_revision = 'passport_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Admin logs table
    op.create_table(
        'admin_logs',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('admin_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('target', sa.String(255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_admin_logs_created_at', 'admin_logs', ['created_at'])
    op.create_index('ix_admin_logs_action', 'admin_logs', ['action'])

    # LLM configs table
    op.create_table(
        'llm_configs',
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('api_key', sa.String(255), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('max_tokens', sa.Integer(), nullable=False, server_default='2000'),
        sa.Column('top_p', sa.Float(), nullable=False, server_default='0.9'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('provider'),
    )

    # Insert default LLM configs
    op.execute("""
        INSERT INTO llm_configs (provider, model, temperature, max_tokens, top_p) VALUES
        ('openai', 'gpt-4o', 0.7, 2000, 0.9),
        ('anthropic', 'claude-3-5-sonnet-20241022', 0.8, 4000, 0.95),
        ('deepseek', 'deepseek-chat', 0.7, 3000, 0.9)
    """)

    # Pricing configs table
    op.create_table(
        'pricing_configs',
        sa.Column('type', sa.String(20), nullable=False),  # 'token_pack' or 'subscription'
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('tokens', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('type', 'name'),
    )

    # Insert default pricing configs
    op.execute("""
        INSERT INTO pricing_configs (type, name, price, tokens, description) VALUES
        ('token_pack', '基础包', 9.9, 100, '适合新手体验'),
        ('token_pack', '标准包', 49.9, 500, '日常学习首选'),
        ('token_pack', '专业包', 99.9, 1000, '深度学习用户'),
        ('subscription', '高级会员', 29.9, 200, '月度订阅，每月赠送200 Token'),
        ('subscription', '企业会员', 99.9, 500, '月度订阅，每月赠送500 Token')
    """)

    # Reward rules table
    op.create_table(
        'reward_rules',
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(100), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('action'),
    )

    # Insert default reward rules
    op.execute("""
        INSERT INTO reward_rules (action, points, description, enabled) VALUES
        ('course_complete', 20, '完成一门课程', true),
        ('question_post', 5, '发布问题', true),
        ('answer_post', 10, '发布回答', true),
        ('answer_accepted', 20, '回答被采纳', true),
        ('note_post', 15, '发布学习笔记', true),
        ('note_liked', 2, '笔记被点赞', true)
    """)

    # Review reward configs table
    op.create_table(
        'review_reward_configs',
        sa.Column('review_type', sa.String(50), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('review_type'),
    )

    # Insert default review reward configs
    op.execute("""
        INSERT INTO review_reward_configs (review_type, points) VALUES
        ('quick_recall', 3),
        ('key_points', 5),
        ('deep_review', 10),
        ('comprehensive', 15)
    """)

    # System settings table
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(50), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('key'),
    )

    # Insert default system settings
    op.execute("""
        INSERT INTO system_settings (key, value, description) VALUES
        ('daily_task_bonus', '50', '每日任务完成奖励积分'),
        ('streak_multiplier', '1.5', '连续打卡奖励倍数'),
        ('max_daily_tasks', '5', '每日任务数量上限'),
        ('review_reminder_days', '1,3,7,14,30', '复习提醒间隔天数')
    """)


def downgrade():
    op.drop_table('system_settings')
    op.drop_table('review_reward_configs')
    op.drop_table('reward_rules')
    op.drop_table('pricing_configs')
    op.drop_table('llm_configs')
    op.drop_index('ix_admin_logs_action', 'admin_logs')
    op.drop_index('ix_admin_logs_created_at', 'admin_logs')
    op.drop_table('admin_logs')