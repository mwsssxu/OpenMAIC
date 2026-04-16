"""
认证中间件 - JWT 验证
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import verify_token
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


async def verify_token_from_ws(token: str) -> str | None:
    """WebSocket token 验证（无数据库依赖）"""
    user_id = verify_token(token, expected_type="access")
    return user_id