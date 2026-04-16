"""
认证路由 - 注册/登录/OAuth
"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import UserRegister, UserLogin, TokenResponse, OAuthLoginRequest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.db.database import get_db
from app.middleware.auth import get_current_user, get_current_user_id
import asyncpg
import uuid

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(
    body: UserRegister,
    db: asyncpg.Connection = Depends(get_db)
):
    """用户注册"""
    # 检查邮箱是否已存在
    existing = await db.fetchrow(
        "SELECT id FROM users WHERE email = $1",
        body.email
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # 创建用户
    user_id = uuid.uuid4()
    password_hash = hash_password(body.password)

    await db.execute(
        """
        INSERT INTO users (id, email, password_hash, nickname)
        VALUES ($1, $2, $3, $4)
        """,
        user_id, body.email, password_hash, body.nickname
    )

    # 返回 token
    access_token = create_access_token(str(user_id))
    refresh_token = create_refresh_token(str(user_id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": str(user_id),
            "email": body.email,
            "nickname": body.nickname
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLogin,
    db: asyncpg.Connection = Depends(get_db)
):
    """用户登录"""
    # 查询用户
    row = await db.fetchrow(
        "SELECT id, email, password_hash, nickname, avatar_url, is_active FROM users WHERE email = $1",
        body.email
    )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive"
        )

    # 返回 token
    access_token = create_access_token(str(row["id"]))
    refresh_token = create_refresh_token(str(row["id"]))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": str(row["id"]),
            "email": row["email"],
            "nickname": row["nickname"],
            "avatar_url": row["avatar_url"]
        }
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """刷新 Token"""
    from app.core.security import verify_token

    user_id = verify_token(refresh_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # 验证用户是否存在
    row = await db.fetchrow(
        "SELECT id, email, nickname, avatar_url, is_active FROM users WHERE id = $1",
        uuid.UUID(user_id)
    )

    if row is None or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # 返回新 token
    new_access_token = create_access_token(str(row["id"]))
    new_refresh_token = create_refresh_token(str(row["id"]))

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user={
            "id": str(row["id"]),
            "email": row["email"],
            "nickname": row["nickname"],
            "avatar_url": row["avatar_url"]
        }
    )


@router.post("/oauth/{provider}")
async def oauth_login(
    provider: str,
    body: OAuthLoginRequest,
    db: asyncpg.Connection = Depends(get_db)
):
    """OAuth 登录（Apple/Google/微信）"""
    # TODO: 实现各 OAuth provider 的 token 验证
    # Apple: 验证 identity token
    # Google: 验证 OAuth access token
    # WeChat: 验证 code 获取 access_token + openid

    # 模拟实现（实际需要调用各平台 API）
    provider_user_id = f"{provider}_{body.token[:20]}"

    # 查找或创建用户
    existing = await db.fetchrow(
        """
        SELECT u.id, u.email, u.nickname, u.avatar_url
        FROM users u
        JOIN oauth_accounts oa ON u.id = oa.user_id
        WHERE oa.provider = $1 AND oa.provider_user_id = $2
        """,
        provider, provider_user_id
    )

    if existing:
        # 已有用户，直接返回 token
        access_token = create_access_token(str(existing["id"]))
        refresh_token = create_refresh_token(str(existing["id"]))
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": str(existing["id"]),
                "email": existing["email"],
                "nickname": existing["nickname"],
                "avatar_url": existing["avatar_url"]
            }
        )

    # 创建新用户
    user_id = uuid.uuid4()
    email = f"{provider}_{provider_user_id}@oauth.placeholder"  # 临时邮箱

    await db.execute(
        """
        INSERT INTO users (id, email, nickname)
        VALUES ($1, $2, $3)
        """,
        user_id, email, body.user_info.get("nickname") if body.user_info else None
    )

    # 创建 OAuth 关联
    await db.execute(
        """
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id)
        VALUES ($1, $2, $3, $4)
        """,
        uuid.uuid4(), user_id, provider, provider_user_id
    )

    # 返回 token
    access_token = create_access_token(str(user_id))
    refresh_token = create_refresh_token(str(user_id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": str(user_id),
            "email": email,
            "nickname": body.user_info.get("nickname") if body.user_info else None
        }
    )


@router.get("/me")
async def get_current_user_info(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取当前用户信息"""
    row = await db.fetchrow(
        "SELECT id, email, nickname, avatar_url, created_at FROM users WHERE id = $1",
        uuid.UUID(current_user_id)
    )
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "nickname": row["nickname"],
        "avatar_url": row["avatar_url"],
        "created_at": row["created_at"].isoformat()
    }