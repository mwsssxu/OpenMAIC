"""
日期时间工具 - 统一时间处理

Python 3.12+ datetime.utcnow() 已弃用
使用 datetime.now(timezone.utc) 替代
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """获取当前UTC时间（替代datetime.utcnow()）"""
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    """获取当前UTC时间的ISO格式字符串"""
    return utcnow().isoformat()


def utcnow_date():
    """获取当前UTC日期"""
    return utcnow().date()


# 为了向后兼容，保留datetime.utcnow的别名
# 但建议使用utcnow()函数