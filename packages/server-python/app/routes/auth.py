"""
认证路由 - 注册/登录/OAuth/用户管理
"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import UserRegister, UserLogin, TokenResponse, OAuthLoginRequest, UserUpdate, PasswordChange, UserStats
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.db.database import get_db
from app.middleware.auth import get_current_user, get_current_user_id
import asyncpg
import uuid
import json
from datetime import datetime

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
    body: dict,
    db: asyncpg.Connection = Depends(get_db)
):
    """刷新 Token"""
    from app.core.security import verify_token

    refresh_token_value = body.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="refresh_token is required"
        )

    user_id = verify_token(refresh_token_value, expected_type="refresh")
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


@router.put("/me")
async def update_user_info(
    body: UserUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新用户信息"""
    # 构建动态更新
    updates = []
    values = []
    idx = 1

    if body.nickname is not None:
        updates.append(f"nickname = ${idx}")
        values.append(body.nickname)
        idx += 1

    if body.avatar_url is not None:
        updates.append(f"avatar_url = ${idx}")
        values.append(body.avatar_url)
        idx += 1

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updates.append(f"updated_at = ${idx}")
    values.append(datetime.utcnow())
    values.append(uuid.UUID(current_user_id))

    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ${idx + 1}"
    await db.execute(query, *values)

    # 返回更新后的用户信息
    row = await db.fetchrow(
        "SELECT id, email, nickname, avatar_url FROM users WHERE id = $1",
        uuid.UUID(current_user_id)
    )
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "nickname": row["nickname"],
        "avatar_url": row["avatar_url"]
    }


@router.post("/password")
async def change_password(
    body: PasswordChange,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """修改密码"""
    # 获取当前密码
    row = await db.fetchrow(
        "SELECT password_hash FROM users WHERE id = $1",
        uuid.UUID(current_user_id)
    )

    # 验证旧密码
    if not verify_password(body.old_password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect"
        )

    # 更新密码
    new_hash = hash_password(body.new_password)
    await db.execute(
        "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3",
        new_hash, datetime.utcnow(), uuid.UUID(current_user_id)
    )

    return {"message": "Password updated successfully"}


@router.delete("/me")
async def delete_account(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """注销账号（GDPR 合规）

    删除用户及所有关联数据：
    - 课程 (stages)
    - 场景 (scenes)
    - 媒体文件 (media_files)
    - OAuth 关联 (oauth_accounts)
    - 生成作业 (generation_jobs)
    """
    # 验证用户存在
    row = await db.fetchrow(
        "SELECT id FROM users WHERE id = $1",
        uuid.UUID(current_user_id)
    )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # 删除用户（CASCADE 会自动删除关联数据）
    await db.execute(
        "DELETE FROM users WHERE id = $1",
        uuid.UUID(current_user_id)
    )

    return {"message": "Account deleted successfully"}


@router.get("/me/export")
async def export_user_data(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """导出用户数据（GDPR 合规）

    导出用户所有个人数据为 JSON 格式
    """
    user_uuid = uuid.UUID(current_user_id)

    # 用户基本信息
    user = await db.fetchrow(
        "SELECT id, email, nickname, avatar_url, created_at, updated_at FROM users WHERE id = $1",
        user_uuid
    )

    # 课程数据
    stages = await db.fetch(
        "SELECT id, name, description, language_directive, style, agent_ids, created_at, updated_at FROM stages WHERE user_id = $1",
        user_uuid
    )

    # 场景数据
    scenes = await db.fetch(
        "SELECT id, stage_id, type, title, order_index, content, actions, whiteboards, created_at FROM scenes WHERE user_id = $1",
        user_uuid
    )

    # 媒体文件
    media = await db.fetch(
        "SELECT id, stage_id, type, oss_key, mime_type, size, prompt, created_at FROM media_files WHERE user_id = $1",
        user_uuid
    )

    # OAuth 关联
    oauth = await db.fetch(
        "SELECT id, provider, provider_user_id, created_at FROM oauth_accounts WHERE user_id = $1",
        user_uuid
    )

    # 生成作业
    jobs = await db.fetch(
        "SELECT id, status, step, progress, message, input_summary, result, error, created_at, updated_at FROM generation_jobs WHERE user_id = $1",
        user_uuid
    )

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "nickname": user["nickname"],
            "avatar_url": user["avatar_url"],
            "created_at": user["created_at"].isoformat(),
            "updated_at": user["updated_at"].isoformat()
        },
        "classrooms": [
            {
                "id": str(s["id"]),
                "name": s["name"],
                "description": s["description"],
                "language_directive": s["language_directive"],
                "style": s["style"],
                "agent_ids": s["agent_ids"],
                "created_at": s["created_at"].isoformat(),
                "updated_at": s["updated_at"].isoformat()
            }
            for s in stages
        ],
        "scenes": [
            {
                "id": str(sc["id"]),
                "stage_id": str(sc["stage_id"]),
                "type": sc["type"],
                "title": sc["title"],
                "order_index": sc["order_index"],
                "content": sc["content"],
                "actions": sc["actions"],
                "whiteboards": sc["whiteboards"],
                "created_at": sc["created_at"].isoformat()
            }
            for sc in scenes
        ],
        "media_files": [
            {
                "id": str(m["id"]),
                "stage_id": str(m["stage_id"]) if m["stage_id"] else None,
                "type": m["type"],
                "oss_key": m["oss_key"],
                "mime_type": m["mime_type"],
                "size": m["size"],
                "prompt": m["prompt"],
                "created_at": m["created_at"].isoformat()
            }
            for m in media
        ],
        "oauth_accounts": [
            {
                "id": str(o["id"]),
                "provider": o["provider"],
                "provider_user_id": o["provider_user_id"],
                "created_at": o["created_at"].isoformat()
            }
            for o in oauth
        ],
        "generation_jobs": [
            {
                "id": str(j["id"]),
                "status": j["status"],
                "step": j["step"],
                "progress": j["progress"],
                "message": j["message"],
                "input_summary": j["input_summary"],
                "result": j["result"],
                "error": j["error"],
                "created_at": j["created_at"].isoformat(),
                "updated_at": j["updated_at"].isoformat()
            }
            for j in jobs
        ]
    }


@router.get("/me/stats", response_model=UserStats)
async def get_user_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户统计数据"""
    user_uuid = uuid.UUID(current_user_id)

    # 统计各类数据
    classrooms_count = await db.fetchval(
        "SELECT COUNT(*) FROM stages WHERE user_id = $1",
        user_uuid
    )

    scenes_count = await db.fetchval(
        "SELECT COUNT(*) FROM scenes WHERE user_id = $1",
        user_uuid
    )

    media_count = await db.fetchval(
        "SELECT COUNT(*) FROM media_files WHERE user_id = $1",
        user_uuid
    )

    # chat_sessions 表可能不存在，返回 0
    try:
        chats_count = await db.fetchval(
            "SELECT COUNT(*) FROM chat_sessions WHERE user_id = $1",
            user_uuid
        )
    except:
        chats_count = 0

    return UserStats(
        total_classrooms=classrooms_count or 0,
        total_scenes=scenes_count or 0,
        total_media_files=media_count or 0,
        total_chat_sessions=chats_count or 0
    )