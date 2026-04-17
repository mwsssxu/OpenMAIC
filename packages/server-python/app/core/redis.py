"""
Redis 连接 - 用于缓存、会话状态、速率限制
"""

import redis.asyncio as redis
from app.core.config import settings
from typing import Optional
import json
from datetime import datetime

# Redis 连接池
redis_pool: redis.Redis = None


async def init_redis():
    """初始化 Redis 连接池"""
    global redis_pool

    redis_pool = redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20
    )

    # 测试连接
    try:
        await redis_pool.ping()
        print("Redis connected successfully")
    except Exception as e:
        print(f"Redis connection failed: {e}")
        # Redis 连接失败不影响服务启动，降级为内存存储


async def close_redis():
    """关闭 Redis 连接"""
    global redis_pool
    if redis_pool:
        await redis_pool.close()


def get_redis() -> redis.Redis:
    """获取 Redis 客户端"""
    return redis_pool


# ==================== 缓存辅助函数 ====================

async def cache_get(key: str) -> Optional[str]:
    """获取缓存"""
    if not redis_pool:
        return None
    return await redis_pool.get(key)


async def cache_set(key: str, value: str, expire: int = 3600) -> bool:
    """设置缓存，默认 1 小时过期"""
    if not redis_pool:
        return False
    await redis_pool.setex(key, expire, value)
    return True


async def cache_delete(key: str) -> bool:
    """删除缓存"""
    if not redis_pool:
        return False
    await redis_pool.delete(key)
    return True


async def cache_get_json(key: str) -> Optional[dict]:
    """获取 JSON 缓存"""
    value = await cache_get(key)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None


async def cache_set_json(key: str, value: dict, expire: int = 3600) -> bool:
    """设置 JSON 缓存"""
    return await cache_set(key, json.dumps(value), expire)


# ==================== 速率限制 ====================

async def rate_limit_check(key: str, max_requests: int, window_seconds: int = 1) -> bool:
    """
    检查速率限制
    key: 速率限制的键（如 user_id 或 room_id:user_id）
    max_requests: 时间窗口内最大请求数
    window_seconds: 时间窗口（秒）

    返回 True 表示允许请求，False 表示超过限制
    """
    if not redis_pool:
        return True  # Redis 不可用时默认允许

    current = await redis_pool.get(key)

    if current is None:
        # 首次请求，设置计数器
        await redis_pool.setex(key, window_seconds, 1)
        return True

    if int(current) >= max_requests:
        return False  # 超过限制

    # 增加计数
    await redis_pool.incr(key)
    return True


async def rate_limit_reset(key: str) -> bool:
    """重置速率限制"""
    if not redis_pool:
        return False
    await redis_pool.delete(key)
    return True


# ==================== Session 管理 ====================

SESSION_EXPIRE = 86400  # 24 小时


async def session_set(user_id: str, session_data: dict) -> bool:
    """设置用户 Session"""
    key = f"session:{user_id}"
    return await cache_set_json(key, session_data, SESSION_EXPIRE)


async def session_get(user_id: str) -> Optional[dict]:
    """获取用户 Session"""
    key = f"session:{user_id}"
    return await cache_get_json(key)


async def session_delete(user_id: str) -> bool:
    """删除用户 Session"""
    key = f"session:{user_id}"
    return await cache_delete(key)


# ==================== Token/积分缓存 ====================

BALANCE_EXPIRE = 300  # 5 分钟


async def cache_token_balance(user_id: str, balance: int) -> bool:
    """缓存用户 Token 余额"""
    key = f"token_balance:{user_id}"
    return await cache_set(key, str(balance), BALANCE_EXPIRE)


async def get_cached_token_balance(user_id: str) -> Optional[int]:
    """获取缓存的 Token 余额"""
    key = f"token_balance:{user_id}"
    value = await cache_get(key)
    if value:
        return int(value)
    return None


async def cache_points_balance(user_id: str, balance: int) -> bool:
    """缓存用户积分余额"""
    key = f"points_balance:{user_id}"
    return await cache_set(key, str(balance), BALANCE_EXPIRE)


async def get_cached_points_balance(user_id: str) -> Optional[int]:
    """获取缓存的积分余额"""
    key = f"points_balance:{user_id}"
    value = await cache_get(key)
    if value:
        return int(value)
    return None


async def invalidate_balance_cache(user_id: str) -> bool:
    """清除用户余额缓存（交易后调用）"""
    await cache_delete(f"token_balance:{user_id}")
    await cache_delete(f"points_balance:{user_id}")
    return True


# ==================== WebSocket 房间状态 ====================

ROOM_EXPIRE = 7200  # 2 小时


async def cache_room_state(room_id: str, state: dict) -> bool:
    """缓存房间状态"""
    key = f"room_state:{room_id}"
    return await cache_set_json(key, state, ROOM_EXPIRE)


async def get_cached_room_state(room_id: str) -> Optional[dict]:
    """获取缓存的房间状态"""
    key = f"room_state:{room_id}"
    return await cache_get_json(key)


async def cache_room_participants(room_id: str, participants: list) -> bool:
    """缓存房间参与者列表"""
    key = f"room_participants:{room_id}"
    return await cache_set_json(key, {"participants": participants}, ROOM_EXPIRE)


async def get_cached_room_participants(room_id: str) -> Optional[list]:
    """获取缓存的房间参与者列表"""
    key = f"room_participants:{room_id}"
    data = await cache_get_json(key)
    if data:
        return data.get("participants", [])
    return None


async def invalidate_room_cache(room_id: str) -> bool:
    """清除房间缓存"""
    await cache_delete(f"room_state:{room_id}")
    await cache_delete(f"room_participants:{room_id}")
    return True