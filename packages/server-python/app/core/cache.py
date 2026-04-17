"""Redis Cache Utilities - 热点数据缓存优化

缓存策略：
1. 用户积分余额 - 缓存5分钟，写入穿透
2. 课程详情 - 缓存10分钟
3. 测评题目 - 缓存30分钟
4. 统计数据 - 缓存1分钟
"""

from app.core.redis import get_redis
from functools import wraps
import json
import hashlib
from typing import Optional, Any
from datetime import datetime


# 缓存键前缀
CACHE_PREFIX = "openmaic:"


# 缓存时长配置（秒）
CACHE_TTL = {
    "user_balance": 300,      # 5分钟
    "course_detail": 600,     # 10分钟
    "assessment_questions": 1800,  # 30分钟
    "stats": 60,              # 1分钟
    "recommendations": 300,   # 5分钟
    "passport": 600,          # 10分钟
    "enterprise_stats": 120,  # 2分钟
}


async def get_cache(key: str) -> Optional[Any]:
    """获取缓存"""
    redis = await get_redis()
    full_key = CACHE_PREFIX + key
    data = await redis.get(full_key)
    if data:
        try:
            return json.loads(data)
        except:
            return data
    return None


async def set_cache(key: str, value: Any, ttl: int = 300):
    """设置缓存"""
    redis = await get_redis()
    full_key = CACHE_PREFIX + key
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    await redis.setex(full_key, ttl, value)


async def delete_cache(key: str):
    """删除缓存"""
    redis = await get_redis()
    full_key = CACHE_PREFIX + key
    await redis.delete(full_key)


async def invalidate_user_cache(user_id: str):
    """清除用户相关缓存"""
    keys_to_delete = [
        f"user_balance:{user_id}",
        f"user_stats:{user_id}",
        f"recommendations:{user_id}",
        f"passport:{user_id}",
    ]
    redis = await get_redis()
    for key in keys_to_delete:
        await redis.delete(CACHE_PREFIX + key)


async def invalidate_course_cache(course_id: str):
    """清除课程相关缓存"""
    keys_to_delete = [
        f"course_detail:{course_id}",
        f"course_stats:{course_id}",
        f"assessment:{course_id}",
    ]
    redis = await get_redis()
    for key in keys_to_delete:
        await redis.delete(CACHE_PREFIX + key)


def cache_result(cache_type: str, key_builder: callable):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 构建缓存键
            key = key_builder(*args, **kwargs)

            # 尝试获取缓存
            cached = await get_cache(key)
            if cached is not None:
                return cached

            # 执行函数
            result = await func(*args, **kwargs)

            # 设置缓存
            ttl = CACHE_TTL.get(cache_type, 300)
            await set_cache(key, result, ttl)

            return result
        return wrapper
    return decorator


# ============ 具体缓存实现 ============

async def cache_user_balance(user_id: str, balance: dict):
    """缓存用户余额"""
    await set_cache(f"user_balance:{user_id}", balance, CACHE_TTL["user_balance"])


async def get_cached_user_balance(user_id: str) -> Optional[dict]:
    """获取缓存的用户余额"""
    return await get_cache(f"user_balance:{user_id}")


async def cache_course_detail(course_id: str, course: dict):
    """缓存课程详情"""
    await set_cache(f"course_detail:{course_id}", course, CACHE_TTL["course_detail"])


async def get_cached_course_detail(course_id: str) -> Optional[dict]:
    """获取缓存的课程详情"""
    return await get_cache(f"course_detail:{course_id}")


async def cache_assessment_questions(assessment_id: str, questions: list):
    """缓存测评题目"""
    await set_cache(f"assessment:{assessment_id}", questions, CACHE_TTL["assessment_questions"])


async def get_cached_assessment_questions(assessment_id: str) -> Optional[list]:
    """获取缓存的测评题目"""
    return await get_cache(f"assessment:{assessment_id}")


async def cache_dashboard_stats(stats: dict):
    """缓存仪表盘统计"""
    await set_cache("dashboard_stats", stats, CACHE_TTL["stats"])


async def get_cached_dashboard_stats() -> Optional[dict]:
    """获取缓存的仪表盘统计"""
    return await get_cache("dashboard_stats")


async def cache_enterprise_stats(enterprise_id: str, stats: dict):
    """缓存企业统计"""
    await set_cache(f"enterprise_stats:{enterprise_id}", stats, CACHE_TTL["enterprise_stats"])


async def get_cached_enterprise_stats(enterprise_id: str) -> Optional[dict]:
    """获取缓存的企业统计"""
    return await get_cache(f"enterprise_stats:{enterprise_id}")


# ============ 缓存预热 ============

async def warmup_cache():
    """缓存预热 - 启动时加载热点数据"""
    # 可在应用启动时调用
    pass


# ============ 缓存监控 ============

async def get_cache_stats():
    """获取缓存统计信息"""
    redis = await get_redis()
    info = await redis.info("memory")

    return {
        "used_memory": info.get("used_memory_human", "unknown"),
        "connected_clients": info.get("connected_clients", 0),
        "total_keys": await redis.dbsize(),
    }