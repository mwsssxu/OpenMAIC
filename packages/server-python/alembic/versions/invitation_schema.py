"""邀请系统数据表迁移

新增表:
- user_invitations: 用户邀请码和邀请记录
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'invitation_schema'
down_revision = 'payment_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 用户邀请码表
    op.create_table(
        'user_invitation_codes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('invite_code', sa.String(16), nullable=False, unique=True),  # 用户专属邀请码
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('ix_user_invitation_codes_user_id', 'user_invitation_codes', ['user_id'])
    op.create_index('ix_user_invitation_codes_invite_code', 'user_invitation_codes', ['invite_code'], unique=True)

    # 邀请记录表
    op.create_table(
        'user_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('inviter_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),  # 邀请人
        sa.Column('invitee_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),  # 被邀请人
        sa.Column('level', sa.Integer, default=1),  # 邀请层级：1=直接邀请, 2=二级, 3=三级
        sa.Column('reward_points', sa.Integer, default=0),  # 已发放积分奖励
        sa.Column('reward_tokens', sa.Integer, default=0),  # 已发放 Token 奖励
        sa.Column('rewarded_at', sa.DateTime),  # 奖励发放时间
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('ix_user_invitations_inviter_id', 'user_invitations', ['inviter_id'])
    op.create_index('ix_user_invitations_invitee_id', 'user_invitations', ['invitee_id'])
    op.create_unique_constraint('uq_user_invitations_invitee', 'user_invitations', ['invitee_id'])  # 每人只能被邀请一次


def downgrade():
    op.drop_table('user_invitations')
    op.drop_table('user_invitation_codes')