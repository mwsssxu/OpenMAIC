"""
数据库连接 - asyncpg 异步连接池
"""

import asyncpg
from datetime import timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# asyncpg 连接池
pool: asyncpg.Pool = None

# SQLAlchemy async engine
engine = None
async_session_maker = None


async def init_db():
    """初始化数据库连接"""
    global pool, engine, async_session_maker

    # asyncpg 连接池（用于高性能查询）
    # 设置时区确保datetime一致处理
    pool = await asyncpg.create_pool(
        settings.DATABASE_URL.replace("postgres://", "postgresql://"),
        min_size=5,
        max_size=20,
        command_timeout=60,
        init=_init_connection  # 初始化每个连接
    )

    # SQLAlchemy async engine（用于 ORM）
    async_url = settings.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")
    engine = create_async_engine(async_url, echo=settings.DEBUG)
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )


async def _init_connection(conn):
    """初始化每个数据库连接 - 设置UTC时区"""
    await conn.execute("SET TIME ZONE 'UTC'")


async def close_db():
    """关闭数据库连接"""
    global pool, engine
    if pool:
        await pool.close()
    if engine:
        await engine.dispose()


async def get_db() -> asyncpg.Connection:
    """获取数据库连接（用于依赖注入）"""
    async with pool.acquire() as conn:
        yield conn


async def get_session() -> AsyncSession:
    """获取 SQLAlchemy session（用于依赖注入）"""
    async with async_session_maker() as session:
        yield session