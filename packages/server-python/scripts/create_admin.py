#!/usr/bin/env python
"""
创建管理员账户脚本
用于初始化管理后台管理员
"""

import asyncio
import sys
import os
import uuid
import getpass
from datetime import datetime, timezone

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_admin():
    """创建管理员账户"""

    # 数据库连接
    db_url = os.getenv("DATABASE_URL", "postgres://maic:password@localhost:5432/maic")

    print("=" * 50)
    print("   OpenMAIC Business 管理员账户创建")
    print("=" * 50)
    print()

    # 输入信息
    email = input("管理员邮箱: ").strip()
    if not email or "@" not in email:
        print("❌ 邮箱格式无效")
        return

    nickname = input("管理员昵称 (可选): ").strip() or "管理员"

    password = getpass.getpass("密码: ")
    if len(password) < 6:
        print("❌ 密码至少6位")
        return

    password_confirm = getpass.getpass("确认密码: ")
    if password != password_confirm:
        print("❌ 密码不匹配")
        return

    is_super = input("是否超级管理员? (y/n): ").strip().lower() == "y"

    print()
    print("正在创建...")

    try:
        # 连接数据库
        conn = await asyncpg.connect(db_url)

        # 检查邮箱是否存在
        existing = await conn.fetchval(
            "SELECT id FROM admins WHERE email = $1", email
        )
        if existing:
            print(f"❌ 邮箱 {email} 已存在")
            await conn.close()
            return

        # 生成密码哈希
        password_hash = pwd_context.hash(password)

        # 创建管理员
        admin_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO admins (id, email, password_hash, nickname, is_super_admin, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            admin_id, email, password_hash, nickname, is_super, datetime.now(timezone.utc)
        )

        # 如果是超级管理员，授予所有权限
        if is_super:
            permissions = [
                "users.list", "users.view", "users.edit", "users.ban",
                "content.questions", "content.notes", "content.comments",
                "statistics.users", "statistics.economy", "statistics.learning",
                "system.config", "system.logs"
            ]
            for perm in permissions:
                await conn.execute(
                    """
                    INSERT INTO admin_permissions (id, admin_id, permission_code, created_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT DO NOTHING
                    """,
                    uuid.uuid4(), admin_id, perm, datetime.now(timezone.utc)
                )

        await conn.close()

        print()
        print("=" * 50)
        print("   ✓ 管理员账户创建成功！")
        print("=" * 50)
        print()
        print(f"邮箱: {email}")
        print(f"昵称: {nickname}")
        print(f"类型: {'超级管理员' if is_super else '普通管理员'}")
        print()
        print("登录地址: http://localhost:3001")
        print()

    except Exception as e:
        print(f"❌ 创建失败: {e}")
        print()
        print("请确保:")
        print("  1. 数据库已启动")
        print("  2. admins表已创建 (执行 alembic upgrade head)")
        print()


if __name__ == "__main__":
    asyncio.run(create_admin())