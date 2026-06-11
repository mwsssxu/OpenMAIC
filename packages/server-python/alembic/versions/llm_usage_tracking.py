"""LLM usage tracking: add price columns to llm_configs + create llm_usage_logs table

Revision ID: llm_usage_tracking
Revises: add_generated_agent_configs
Create Date: 2026-06-10

Changes:
- llm_configs: add input_price_per_1k, output_price_per_1k columns (元/千token)
- llm_usage_logs: new table to record every LLM call with token counts and cost
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'llm_usage_tracking'
down_revision = 'add_generated_agent_configs'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add price columns to llm_configs
    op.add_column('llm_configs', sa.Column('input_price_per_1k', sa.Float(), nullable=True, server_default='0'))
    op.add_column('llm_configs', sa.Column('output_price_per_1k', sa.Float(), nullable=True, server_default='0'))

    # Set default prices for known models (DashScope qwen pricing)
    op.execute("""
        UPDATE llm_configs SET input_price_per_1k = 0.004, output_price_per_1k = 0.012
        WHERE model IN ('qwen3.6-plus', 'qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-vl-max')
    """)

    # Update pricing_configs to reflect new prices
    # 价格单位：分（与 app.core.pricing.py 保持一致）
    op.execute("""
        DELETE FROM pricing_configs WHERE type = 'token_pack'
    """)
    op.execute("""
        INSERT INTO pricing_configs (type, name, price, tokens, description) VALUES
        ('token_pack', '体验包', 600, 50, '¥6 = 50 Token，适合新手体验'),
        ('token_pack', '学习包', 1800, 200, '¥18 = 200 Token（含20赠送），日常学习首选'),
        ('token_pack', '畅学包', 4800, 600, '¥48 = 600 Token（含100赠送），深度学习用户')
    """)
    op.execute("""
        UPDATE pricing_configs SET price = 1900, tokens = 50, description = 'Pro月卡 ¥19/月，每月赠送50 Token'
        WHERE type = 'subscription' AND name = '高级会员'
    """)

    # 2. Create llm_usage_logs table
    op.create_table(
        'llm_usage_logs',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('scene_type', sa.String(50), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cost_yuan', sa.Float(), nullable=False, server_default='0'),
        sa.Column('input_price_per_1k', sa.Float(), nullable=False, server_default='0'),
        sa.Column('output_price_per_1k', sa.Float(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='success'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_llm_usage_created_at', 'llm_usage_logs', ['created_at'])
    op.create_index('ix_llm_usage_user_id', 'llm_usage_logs', ['user_id'])
    op.create_index('ix_llm_usage_model', 'llm_usage_logs', ['model'])
    op.create_index('ix_llm_usage_scene', 'llm_usage_logs', ['scene_type'])


def downgrade():
    op.drop_index('ix_llm_usage_scene', 'llm_usage_logs')
    op.drop_index('ix_llm_usage_model', 'llm_usage_logs')
    op.drop_index('ix_llm_usage_user_id', 'llm_usage_logs')
    op.drop_index('ix_llm_usage_created_at', 'llm_usage_logs')
    op.drop_table('llm_usage_logs')
    op.drop_column('llm_configs', 'output_price_per_1k')
    op.drop_column('llm_configs', 'input_price_per_1k')
