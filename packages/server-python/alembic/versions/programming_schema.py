"""Programming learning vertical template tables

Revision ID: programming_schema
Revises: depth_levels_schema
Create Date: 2026-04-17

Tables:
- programming_exercises: 编程练习题表
- code_submissions: 代码提交记录表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'programming_schema'
down_revision = 'depth_levels_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Programming exercises table
    op.create_table(
        'programming_exercises',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('difficulty', sa.String(20), server_default='medium'),  # 'easy', 'medium', 'hard'
        sa.Column('language', sa.String(20), nullable=False),  # 'python', 'javascript', 'java', 'cpp'
        sa.Column('starter_code', sa.Text()),
        sa.Column('test_cases', sa.Text()),  # JSON array
        sa.Column('hints', sa.Text()),  # JSON array
        sa.Column('max_score', sa.Integer(), server_default='100'),
        sa.Column('time_limit', sa.Integer(), server_default='10'),  # seconds
        sa.Column('memory_limit', sa.Integer(), server_default='256'),  # MB
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['course_id'], ['stages.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_exercises_course', 'programming_exercises', ['course_id'])
    op.create_index('ix_exercises_language', 'programming_exercises', ['language'])

    # Code submissions table
    op.create_table(
        'code_submissions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('exercise_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('language', sa.String(20), nullable=False),
        sa.Column('passed', sa.Boolean(), server_default='false'),
        sa.Column('score', sa.Integer(), server_default='0'),
        sa.Column('execution_time', sa.Float()),
        sa.Column('memory_used', sa.Float()),
        sa.Column('errors', sa.Text()),  # JSON array
        sa.Column('submitted_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['programming_exercises.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_submissions_user', 'code_submissions', ['user_id'])
    op.create_index('ix_submissions_exercise', 'code_submissions', ['exercise_id'])
    op.create_index('ix_submissions_language', 'code_submissions', ['language'])

    # Insert sample exercises
    op.execute("""
        INSERT INTO programming_exercises (course_id, title, description, difficulty, language, starter_code, max_score) VALUES
        ('00000000-0000-0000-0000-000000000001', 'Hello World', '输出 Hello World', 'easy', 'python', 'print("Hello World")', 10),
        ('00000000-0000-0000-0000-000000000001', '计算平方', '编写函数计算数字的平方', 'easy', 'python', 'def square(n):\\n    return n * n', 20),
        ('00000000-0000-0000-0000-000000000001', '字符串反转', '反转输入字符串', 'medium', 'python', 'def reverse_string(s):\\n    pass', 30),
        ('00000000-0000-0000-0000-000000000001', '数组排序', '实现冒泡排序算法', 'medium', 'python', 'def bubble_sort(arr):\\n    pass', 50),
        ('00000000-0000-0000-0000-000000000001', '二叉树遍历', '实现二叉树前序遍历', 'hard', 'python', 'def preorder_traversal(root):\\n    pass', 100)
    """)


def downgrade():
    op.drop_index('ix_submissions_language', 'code_submissions')
    op.drop_index('ix_submissions_exercise', 'code_submissions')
    op.drop_index('ix_submissions_user', 'code_submissions')
    op.drop_table('code_submissions')
    op.drop_index('ix_exercises_language', 'programming_exercises')
    op.drop_index('ix_exercises_course', 'programming_exercises')
    op.drop_table('programming_exercises')