"""initial schema

Revision ID: initial
Revises:
Create Date: 2026-04-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 用户表
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('nickname', sa.String(100)),
        sa.Column('avatar_url', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_users_email', 'users', ['email'])

    # OAuth 关联表
    op.create_table(
        'oauth_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('provider_user_id', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_oauth_user_id', 'oauth_accounts', ['user_id'])
    op.create_unique_constraint('uq_oauth_provider_user', 'oauth_accounts', ['provider', 'provider_user_id'])

    # 课程表
    op.create_table(
        'stages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('language_directive', sa.Text),
        sa.Column('style', sa.Text),
        sa.Column('agent_ids', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_stages_user_id', 'stages', ['user_id'])

    # 场景表
    op.create_table(
        'scenes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('stage_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('order_index', sa.Integer),
        sa.Column('content', postgresql.JSONB),
        sa.Column('actions', postgresql.JSONB),
        sa.Column('whiteboards', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_scenes_user_id', 'scenes', ['user_id'])
    op.create_index('idx_scenes_stage_id', 'scenes', ['stage_id'])

    # 媒体文件表
    op.create_table(
        'media_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stage_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='CASCADE')),
        sa.Column('type', sa.String(50)),
        sa.Column('oss_key', sa.Text),
        sa.Column('oss_bucket', sa.String(100)),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('size', sa.Integer),
        sa.Column('prompt', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_media_files_user_id', 'media_files', ['user_id'])

    # 生成作业表
    op.create_table(
        'generation_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(50)),
        sa.Column('step', sa.String(50)),
        sa.Column('progress', sa.Integer),
        sa.Column('message', sa.Text),
        sa.Column('input_summary', postgresql.JSONB),
        sa.Column('result', postgresql.JSONB),
        sa.Column('error', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_generation_jobs_user_id', 'generation_jobs', ['user_id'])


def downgrade() -> None:
    op.drop_table('generation_jobs')
    op.drop_table('media_files')
    op.drop_table('scenes')
    op.drop_table('stages')
    op.drop_table('oauth_accounts')
    op.drop_table('users')