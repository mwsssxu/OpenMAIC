"""问答悬赏系统数据表迁移

新增表:
- questions: 问题表（含悬赏积分）
- answers: 回答表（含评分、采纳状态）
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

revision = 'questions_answers_schema'
down_revision = 'invitation_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 问题表（先创建，不含 accepted_answer_id）
    op.create_table(
        'questions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('bounty', sa.Integer, default=0),  # 悬赏积分
        sa.Column('bounty_status', sa.String(20), default='open'),  # open, claimed, closed
        sa.Column('tags', sa.Text),  # 标签（逗号分隔）
        sa.Column('view_count', sa.Integer, default=0),
        sa.Column('answer_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('ix_questions_user_id', 'questions', ['user_id'])
    op.create_index('ix_questions_created_at', 'questions', ['created_at'])
    op.create_index('ix_questions_bounty_status', 'questions', ['bounty_status'])

    # 回答表
    op.create_table(
        'answers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('question_id', UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('rating', sa.Integer, default=0),  # 评分（-1, 0, 1 或 1-5）
        sa.Column('vote_count', sa.Integer, default=0),  # 投票数
        sa.Column('is_accepted', sa.Boolean, default=False),  # 是否被采纳
        sa.Column('accepted_at', sa.DateTime),  # 采纳时间
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
    op.create_index('ix_answers_question_id', 'answers', ['question_id'])
    op.create_index('ix_answers_user_id', 'answers', ['user_id'])
    op.create_index('ix_answers_is_accepted', 'answers', ['is_accepted'])

    # 回答投票表（防止重复投票）
    op.create_table(
        'answer_votes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('answer_id', UUID(as_uuid=True), sa.ForeignKey('answers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vote', sa.Integer, nullable=False),  # 1=赞成, -1=反对
        sa.Column('created_at', sa.DateTime, default=datetime.utcnow),
    )
    op.create_unique_constraint('uq_answer_votes_answer_user', 'answer_votes', ['answer_id', 'user_id'])
    op.create_index('ix_answer_votes_answer_id', 'answer_votes', ['answer_id'])

    # 后添加 accepted_answer_id 列（避免循环引用）
    op.add_column('questions', sa.Column('accepted_answer_id', UUID(as_uuid=True), sa.ForeignKey('answers.id', ondelete='SET NULL')))


def downgrade():
    op.drop_table('answer_votes')
    op.drop_table('answers')
    op.drop_table('questions')