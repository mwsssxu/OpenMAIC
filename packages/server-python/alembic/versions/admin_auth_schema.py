"""Admin authentication and RBAC system tables

Revision ID: admin_auth_schema
Revises: admin_schema
Create Date: 2026-04-17

Tables:
- admins: 管理员账户表
- admin_roles: 管理员角色表
- admin_permissions: 权限定义表
- role_permissions: 角色-权限关联表
- admin_sessions: 管理员会话表
- login_logs: 登录日志表
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'admin_auth_schema'
down_revision = 'admin_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Admins table
    op.create_table(
        'admins',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('nickname', sa.String(100)),
        sa.Column('is_super_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime()),
        sa.Column('last_login_ip', sa.String(50)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admins_email', 'admins', ['email'])

    # Admin roles table
    op.create_table(
        'admin_roles',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )

    # Insert default roles
    op.execute("""
        INSERT INTO admin_roles (name, description) VALUES
        ('super_admin', '超级管理员 - 所有权限'),
        ('content_manager', '内容管理员 - 内容审核权限'),
        ('user_manager', '用户管理员 - 用户管理权限'),
        ('finance_manager', '财务管理员 - 经济数据查看'),
        ('viewer', '观察者 - 只读权限')
    """)

    # Admin-role association
    op.create_table(
        'admin_role_assignments',
        sa.Column('admin_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('assigned_by', sa.UUID()),
        sa.PrimaryKeyConstraint('admin_id', 'role_id'),
        sa.ForeignKeyConstraint(['admin_id'], ['admins.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['admins.id']),
    )

    # Permissions table
    op.create_table(
        'admin_permissions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(100), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('category', sa.String(50)),  # 'users', 'content', 'finance', 'settings'
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )

    # Insert default permissions
    op.execute("""
        INSERT INTO admin_permissions (code, name, category, description) VALUES
        ('users.list', '查看用户列表', 'users', '查看所有用户'),
        ('users.view', '查看用户详情', 'users', '查看用户详细信息'),
        ('users.ban', '禁用用户', 'users', '禁用/启用用户账号'),
        ('users.gift', '赠送资源', 'users', '赠送Token/积分给用户'),
        ('content.list', '查看内容列表', 'content', '查看待审核内容'),
        ('content.approve', '审核通过', 'content', '审核通过内容'),
        ('content.reject', '审核拒绝', 'content', '审核拒绝内容'),
        ('finance.view', '查看财务数据', 'finance', '查看收入/支出数据'),
        ('settings.view', '查看系统设置', 'settings', '查看LLM/价格/规则配置'),
        ('settings.edit', '修改系统设置', 'settings', '修改LLM/价格/规则配置'),
        ('logs.view', '查看操作日志', 'settings', '查看所有管理员操作日志'),
        ('admin.manage', '管理管理员', 'settings', '添加/删除管理员，分配角色')
    """)

    # Role-permission association
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint('role_id', 'permission_id'),
        sa.ForeignKeyConstraint(['role_id'], ['admin_roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['admin_permissions.id'], ondelete='CASCADE'),
    )

    # Assign permissions to roles
    # super_admin: all permissions
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM admin_roles r, admin_permissions p WHERE r.name = 'super_admin'
    """)
    
    # content_manager: content permissions + logs.view
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM admin_roles r, admin_permissions p
        WHERE r.name = 'content_manager' AND p.code IN ('content.list', 'content.approve', 'content.reject', 'logs.view')
    """)
    
    # user_manager: user permissions + logs.view
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM admin_roles r, admin_permissions p
        WHERE r.name = 'user_manager' AND p.code IN ('users.list', 'users.view', 'users.ban', 'users.gift', 'logs.view')
    """)
    
    # finance_manager: finance permissions
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM admin_roles r, admin_permissions p
        WHERE r.name = 'finance_manager' AND p.code IN ('finance.view', 'logs.view')
    """)
    
    # viewer: view permissions only
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM admin_roles r, admin_permissions p
        WHERE r.name = 'viewer' AND p.code LIKE '%.view'
    """)
    
    # Admin sessions table
    op.create_table(
        'admin_sessions',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('admin_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['admin_id'], ['admins.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_admin_sessions_token', 'admin_sessions', ['token_hash'])
    op.create_index('ix_admin_sessions_admin', 'admin_sessions', ['admin_id'])

    # Login logs table
    op.create_table(
        'login_logs',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('admin_id', sa.UUID()),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(100)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['admin_id'], ['admins.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_login_logs_created', 'login_logs', ['created_at'])

    # Create a default super admin (password: admin123)
    # In production, this should be changed immediately
    op.execute("""
        INSERT INTO admins (email, password_hash, nickname, is_super_admin, is_active)
        VALUES ('admin@openmaic.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.OyG.9.X5F1', '超级管理员', true, true)
    """)


def downgrade():
    op.drop_index('ix_login_logs_created', 'login_logs')
    op.drop_table('login_logs')
    op.drop_index('ix_admin_sessions_admin', 'admin_sessions')
    op.drop_index('ix_admin_sessions_token', 'admin_sessions')
    op.drop_table('admin_sessions')
    op.drop_table('role_permissions')
    op.drop_table('admin_permissions')
    op.drop_table('admin_role_assignments')
    op.drop_table('admin_roles')
    op.drop_index('ix_admins_email', 'admins')
    op.drop_table('admins')