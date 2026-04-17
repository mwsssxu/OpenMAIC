"""AI Personas - Historical figures as learning companions

Revision ID: personas_schema
Revises: share_cards_schema
Create Date: 2026-04-17

Tables:
- persona_sessions: 智能体对话会话表
- persona_messages: 智能体对话消息表
- persona_stats: 智能体统计数据表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'personas_schema'
down_revision = 'share_cards_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Persona sessions table
    op.create_table(
        'persona_sessions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('persona_id', sa.String(50), nullable=False),  # 'confucius', 'socrates', 'da_vinci'
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime()),
        sa.Column('message_count', sa.Integer(), server_default='0'),
        sa.Column('topic', sa.Text()),
        sa.Column('rating', sa.Integer()),  # 1-5 stars
        sa.Column('feedback', sa.Text()),
        sa.Column('mode', sa.String(20), server_default='teaching'),  # 'teaching', 'discussion', 'questioning'
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_persona_sessions_user', 'persona_sessions', ['user_id'])
    op.create_index('ix_persona_sessions_persona', 'persona_sessions', ['persona_id'])

    # Persona messages table
    op.create_table(
        'persona_messages',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('user_message', sa.Text(), nullable=False),
        sa.Column('persona_response', sa.Text(), nullable=False),
        sa.Column('style_used', sa.String(50)),
        sa.Column('quotes_used', sa.Text()),  # JSON array
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['session_id'], ['persona_sessions.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_persona_messages_session', 'persona_messages', ['session_id'])

    # Persona stats table (aggregated)
    op.create_table(
        'persona_stats',
        sa.Column('persona_id', sa.String(50), nullable=False, primary_key=True),
        sa.Column('total_sessions', sa.Integer(), server_default='0'),
        sa.Column('total_messages', sa.Integer(), server_default='0'),
        sa.Column('avg_rating', sa.Float(), server_default='0'),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.text('now()')),
    )

    # Insert initial stats
    op.execute("""
        INSERT INTO persona_stats (persona_id) VALUES
        ('confucius'),
        ('socrates'),
        ('da_vinci')
    """)


def downgrade():
    op.drop_table('persona_stats')
    op.drop_index('ix_persona_messages_session', 'persona_messages')
    op.drop_table('persona_messages')
    op.drop_index('ix_persona_sessions_persona', 'persona_sessions')
    op.drop_index('ix_persona_sessions_user', 'persona_sessions')
    op.drop_table('persona_sessions')