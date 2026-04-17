"""Enterprise Module tables - 企业功能模块

Revision ID: enterprise_schema
Revises: note_citations_schema
Create Date: 2026-04-17

Tables:
- enterprises: 企业账户表
- enterprise_members: 企业成员表
- enterprise_invites: 企业邀请表
- enterprise_courses: 企业课程分配表
- enterprise_course_progress: 企业课程进度表
- enterprise_course_completions: 企业课程完成记录表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'enterprise_schema'
down_revision = 'note_citations_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 企业账户表
    op.create_table(
        'enterprises',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('industry', sa.String(100)),
        sa.Column('size', sa.String(20)),  # small, medium, large
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(50)),
        sa.Column('plan_type', sa.String(20), server_default='basic'),  # basic, pro, enterprise
        sa.Column('member_count', sa.Integer(), server_default='1'),
        sa.Column('member_limit', sa.Integer(), server_default='10'),
        sa.Column('course_count', sa.Integer(), server_default='0'),
        sa.Column('course_limit', sa.Integer(), server_default='50'),
        sa.Column('storage_used', sa.Integer(), server_default='0'),  # MB
        sa.Column('storage_limit', sa.Integer(), server_default='100'),  # MB
        sa.Column('subscription_starts_at', sa.DateTime()),
        sa.Column('subscription_ends_at', sa.DateTime()),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_enterprises_owner', 'enterprises', ['owner_id'])
    op.create_index('ix_enterprises_status', 'enterprises', ['status'])

    # 企业成员表
    op.create_table(
        'enterprise_members',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('enterprise_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(20), server_default='member'),  # owner, admin, member, viewer
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('last_active_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['enterprise_id'], ['enterprises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('enterprise_id', 'user_id', name='uq_enterprise_member'),
    )
    op.create_index('ix_enterprise_members_enterprise', 'enterprise_members', ['enterprise_id'])
    op.create_index('ix_enterprise_members_user', 'enterprise_members', ['user_id'])

    # 企业邀请表
    op.create_table(
        'enterprise_invites',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('enterprise_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), server_default='member'),
        sa.Column('invite_code', sa.String(12), nullable=False),
        sa.Column('invited_by', sa.UUID(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime()),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['enterprise_id'], ['enterprises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_enterprise_invites_enterprise', 'enterprise_invites', ['enterprise_id'])
    op.create_index('ix_enterprise_invites_email', 'enterprise_invites', ['email'])
    op.create_index('ix_enterprise_invites_code', 'enterprise_invites', ['invite_code'])

    # 企业课程分配表
    op.create_table(
        'enterprise_courses',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('enterprise_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('assigned_by', sa.UUID(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('is_required', sa.Boolean(), server_default='false'),
        sa.Column('deadline', sa.DateTime()),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['enterprise_id'], ['enterprises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('enterprise_id', 'course_id', name='uq_enterprise_course'),
    )
    op.create_index('ix_enterprise_courses_enterprise', 'enterprise_courses', ['enterprise_id'])

    # 企业课程进度表
    op.create_table(
        'enterprise_course_progress',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('enterprise_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('scenes_completed', sa.Integer(), server_default='0'),
        sa.Column('total_scenes', sa.Integer()),
        sa.Column('completion_rate', sa.Float(), server_default='0'),
        sa.Column('time_spent_minutes', sa.Integer(), server_default='0'),
        sa.Column('started_at', sa.DateTime()),
        sa.Column('last_accessed_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['enterprise_id'], ['enterprises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('enterprise_id', 'user_id', 'course_id', name='uq_enterprise_progress'),
    )
    op.create_index('ix_enterprise_progress_enterprise', 'enterprise_course_progress', ['enterprise_id'])
    op.create_index('ix_enterprise_progress_user', 'enterprise_course_progress', ['user_id'])

    # 企业课程完成记录表
    op.create_table(
        'enterprise_course_completions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('enterprise_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('time_spent_minutes', sa.Integer()),
        sa.Column('score', sa.Float()),
        sa.Column('mastery_level', sa.String(20)),
        sa.Column('completed_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['enterprise_id'], ['enterprises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_enterprise_completions_enterprise', 'enterprise_course_completions', ['enterprise_id'])


def downgrade():
    op.drop_index('ix_enterprise_completions_enterprise', 'enterprise_course_completions')
    op.drop_table('enterprise_course_completions')

    op.drop_index('ix_enterprise_progress_user', 'enterprise_course_progress')
    op.drop_index('ix_enterprise_progress_enterprise', 'enterprise_course_progress')
    op.drop_table('enterprise_course_progress')

    op.drop_index('ix_enterprise_courses_enterprise', 'enterprise_courses')
    op.drop_table('enterprise_courses')

    op.drop_index('ix_enterprise_invites_code', 'enterprise_invites')
    op.drop_index('ix_enterprise_invites_email', 'enterprise_invites')
    op.drop_index('ix_enterprise_invites_enterprise', 'enterprise_invites')
    op.drop_table('enterprise_invites')

    op.drop_index('ix_enterprise_members_user', 'enterprise_members')
    op.drop_index('ix_enterprise_members_enterprise', 'enterprise_members')
    op.drop_table('enterprise_members')

    op.drop_index('ix_enterprises_status', 'enterprises')
    op.drop_index('ix_enterprises_owner', 'enterprises')
    op.drop_table('enterprises')