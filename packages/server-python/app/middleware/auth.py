"""
认证中间件 - JWT 验证
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import verify_token
from app.core.request_context import set_current_user_id
from app.db.database import get_db
from app.models.user import UserResponse
import asyncpg

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Connection = Depends(get_db)
) -> UserResponse:
    """从 JWT 获取当前用户"""
    token = credentials.credentials
    user_id = verify_token(token, expected_type="access")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # 查询用户
    row = await db.fetchrow(
        "SELECT id, email, nickname, avatar_url, is_active FROM users WHERE id = $1",
        user_id
    )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive"
        )

    # 写入请求上下文 — llm.py 等深层服务可零侵入读取归因
    set_current_user_id(str(row["id"]) if row["id"] else None)

    return UserResponse(
        id=str(row["id"]),
        email=row["email"],
        nickname=row["nickname"],
        avatar_url=row["avatar_url"]
    )


async def get_current_user_id(
    current_user: UserResponse = Depends(get_current_user)
) -> str:
    """仅获取用户 ID（简化依赖）"""
    return current_user.id


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: asyncpg.Connection = Depends(get_db)
) -> str | None:
    """可选认证 - 未登录返回 None，已登录但用户被禁用也返回 None"""
    if credentials is None:
        return None
    token = credentials.credentials
    user_id = verify_token(token, expected_type="access")
    if user_id is None:
        return None
    # 验证用户存在且未被禁用（与 get_current_user 保持一致）
    row = await db.fetchrow(
        "SELECT is_active FROM users WHERE id = $1",
        user_id
    )
    if row is None or not row["is_active"]:
        return None
    set_current_user_id(user_id)
    return user_id


async def verify_token_from_ws(token: str) -> str | None:
    """WebSocket token 验证（无数据库依赖）"""
    user_id = verify_token(token, expected_type="access")
    if user_id:
        set_current_user_id(user_id)
    return user_id