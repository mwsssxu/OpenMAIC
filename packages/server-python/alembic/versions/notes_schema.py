"""共享笔记系统数据表迁移

新增表:
- shared_notes: 共享笔记表
- note_purchases: 笔记购买记录
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'notes_schema'
down_revision = 'buddy_schema'
branch_labels = None
depends_on = 'buddy_schema'


def upgrade():
    # 共享笔记表
    op.create_table(
        'shared_notes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('stages.id', ondelete='SET NULL')),
        sa.Column('visibility', sa.String(20), default='public'),  # 'public', 'paid', 'matched'
        sa.Column('price', sa.Integer, default=0),  # 价格（积分）
        sa.Column('tags', sa.Text),
        sa.Column('rating', sa.Float, default=0),
        sa.Column('rating_count', sa.Integer, default=0),
        sa.Column('purchase_count', sa.Integer, default=0),
        sa.Column('status', sa.String(20), default='published'),  # 'draft', 'published', 'deleted'
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('idx_shared_notes_user', 'shared_notes', ['user_id'])
    op.create_index('idx_shared_notes_course', 'shared_notes', ['course_id'])
    op.create_index('idx_shared_notes_visibility', 'shared_notes', ['visibility'])
    op.create_index('idx_shared_notes_rating', 'shared_notes', ['rating'])

    # 笔记购买记录表
    op.create_table(
        'note_purchases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('note_id', UUID(as_uuid=True), sa.ForeignKey('shared_notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('price', sa.Integer, nullable=False),  # 购买价格
        sa.Column('author_reward', sa.Integer, nullable=False),  # 作者收益（70%）
        sa.Column('platform_fee', sa.Integer, nullable=False),  # 平台费用（30%）
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_index('idx_note_purchases_user', 'note_purchases', ['user_id'])
    op.create_index('idx_note_purchases_note', 'note_purchases', ['note_id'])
    op.create_unique_constraint('uq_note_purchases_user_note', 'note_purchases', ['user_id', 'note_id'])


def downgrade():
    op.drop_table('note_purchases')
    op.drop_table('shared_notes')