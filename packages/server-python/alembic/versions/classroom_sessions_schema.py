"""add classroom sessions tables

Revision ID: classroom_sessions
Revises: gamification
Create Date: 2026-04-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'classroom_sessions'
down_revision: Union[str, None] = 'gamification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 课堂会话表
    op.create_table(
        'classroom_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('stage_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE')),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('room_id', sa.String(50), unique=True, nullable=False),
        sa.Column('status', sa.String(20), default='active'),  # active, ended
        sa.Column('participant_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime),
    )
    op.create_index('idx_sessions_room_id', 'classroom_sessions', ['room_id'])
    op.create_index('idx_sessions_owner_id', 'classroom_sessions', ['owner_id'])

    # 2. 会话消息表
    op.create_table(
        'classroom_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('classroom_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('message_type', sa.String(20), default='chat'),  # chat, agent, system
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_messages_session_id', 'classroom_messages', ['session_id'])

    # 3. 会话参与者表
    op.create_table(
        'session_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('classroom_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), default='participant'),  # owner, participant
        sa.Column('joined_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('left_at', sa.DateTime),
    )
    op.create_index('idx_participants_session_id', 'session_participants', ['session_id'])
    op.create_unique_constraint('uq_participant_session_user', 'session_participants', ['session_id', 'user_id'])

    # 4. 白板状态表（可选，用于持久化）
    op.create_table(
        'whiteboard_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('classroom_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scene_index', sa.Integer, default=0),
        sa.Column('elements', postgresql.JSONB, default=[]),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_whiteboard_session_id', 'whiteboard_states', ['session_id'])


def downgrade() -> None:
    op.drop_table('whiteboard_states')
    op.drop_table('session_participants')
    op.drop_table('classroom_messages')
    op.drop_table('classroom_sessions')