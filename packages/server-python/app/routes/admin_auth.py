"""
Admin authentication routes - JWT-based auth with RBAC.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
import asyncpg
import hashlib
import secrets
import bcrypt
import jwt
from app.db.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])
security = HTTPBearer()

JWT_SECRET = settings.SECRET_KEY or "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
SESSION_DURATION_HOURS = 8


# ============ Models ============

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    admin_id: str
    nickname: str
    roles: List[str]
    expires_at: datetime


class AdminInfo(BaseModel):
    id: str
    email: str
    nickname: str
    is_super_admin: bool
    roles: List[str]
    permissions: List[str]


class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str
    roles: List[str] = ["viewer"]


class RoleAssignment(BaseModel):
    admin_id: str
    roles: List[str]


# ============ Auth Helpers ============

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hash: str) -> bool:
    """Verify password against hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8'))
    except:
        return False


def generate_token() -> str:
    """Generate secure random token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_jwt(admin_id: str, roles: List[str]) -> str:
    """Create JWT token."""
    payload = {
        "admin_id": admin_id,
        "roles": roles,
        "exp": utcnow() + timedelta(hours=SESSION_DURATION_HOURS),
        "iat": utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Decode JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(
    request: Request,
    token: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Connection = Depends(get_db)
) -> dict:
    """Get current admin from token."""
    # Decode JWT
    payload = decode_jwt(token.credentials)
    admin_id = payload.get("admin_id")

    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Verify admin exists and is active
    admin = await db.fetchrow(
        """
        SELECT a.id, a.email, a.nickname, a.is_super_admin, a.is_active
        FROM admins a
        WHERE a.id = $1
        """,
        admin_id
    )

    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")

    if not admin["is_active"]:
        raise HTTPException(status_code=401, detail="Admin account disabled")

    # Get roles
    roles = await db.fetch(
        """
        SELECT r.name
        FROM admin_roles r
        JOIN admin_role_assignments ara ON r.id = ara.role_id
        WHERE ara.admin_id = $1
        """,
        admin_id
    )

    role_names = [r["name"] for r in roles]

    return {
        "id": str(admin["id"]),
        "email": admin["email"],
        "nickname": admin["nickname"],
        "is_super_admin": admin["is_super_admin"],
        "roles": role_names
    }


async def check_permission(
    permission_code: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
) -> dict:
    """Check if admin has specific permission."""
    # Super admin has all permissions
    if admin["is_super_admin"]:
        return admin

    # Check permission via roles
    has_permission = await db.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM admin_role_assignments ara
            JOIN role_permissions rp ON ara.role_id = rp.role_id
            JOIN admin_permissions ap ON rp.permission_id = ap.id
            WHERE ara.admin_id = $1 AND ap.code = $2
        )
        """,
        admin["id"],
        permission_code
    )

    if not has_permission:
        raise HTTPException(status_code=403, detail=f"Permission denied: {permission_code}")

    return admin


# ============ Permission Dependencies ============
async def _require_admin_manage(admin: dict = Depends(get_current_admin), db: asyncpg.Connection = Depends(get_db)) -> dict:
    return await check_permission("admin.manage", admin, db)

async def _require_admin_view(admin: dict = Depends(get_current_admin), db: asyncpg.Connection = Depends(get_db)) -> dict:
    return await check_permission("admin.view", admin, db)

async def _require_admin_logs(admin: dict = Depends(get_current_admin), db: asyncpg.Connection = Depends(get_db)) -> dict:
    return await check_permission("admin.logs", admin, db)


async def get_admin_permissions(
    admin_id: str,
    db: asyncpg.Connection
) -> List[str]:
    """Get all permissions for an admin."""
    permissions = await db.fetch(
        """
        SELECT DISTINCT ap.code
        FROM admin_permissions ap
        JOIN role_permissions rp ON ap.id = rp.permission_id
        JOIN admin_role_assignments ara ON rp.role_id = ara.role_id
        WHERE ara.admin_id = $1
        """,
        admin_id
    )
    return [p["code"] for p in permissions]


# ============ Routes ============

@router.post("/login", response_model=LoginResponse)
async def admin_login(
    request: Request,
    body: LoginRequest,
    db: asyncpg.Connection = Depends(get_db)
):
    """Admin login."""
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    # Find admin
    admin = await db.fetchrow(
        """
        SELECT id, email, password_hash, nickname, is_super_admin, is_active
        FROM admins
        WHERE email = $1
        """,
        body.email
    )

    # Log login attempt
    async def log_login(success: bool, reason: Optional[str] = None):
        await db.execute(
            """
            INSERT INTO login_logs (admin_id, email, ip_address, user_agent, success, failure_reason, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            admin["id"] if admin else None,
            body.email,
            ip_address,
            user_agent,
            success,
            reason,
            utcnow()
        )

    if not admin:
        await log_login(False, "Admin not found")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not admin["is_active"]:
        await log_login(False, "Account disabled")
        raise HTTPException(status_code=401, detail="Account disabled")

    if not verify_password(body.password, admin["password_hash"]):
        await log_login(False, "Invalid password")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Get roles
    roles = await db.fetch(
        """
        SELECT r.name
        FROM admin_roles r
        JOIN admin_role_assignments ara ON r.id = ara.role_id
        WHERE ara.admin_id = $1
        """,
        admin["id"]
    )
    role_names = [r["name"] for r in roles]

    # Create JWT
    jwt_token = create_jwt(str(admin["id"]), role_names)
    expires_at = utcnow() + timedelta(hours=SESSION_DURATION_HOURS)

    # Create session
    session_token = generate_token()
    token_hash = hash_token(session_token)
    await db.execute(
        """
        INSERT INTO admin_sessions (admin_id, token_hash, ip_address, user_agent, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        admin["id"],
        token_hash,
        ip_address,
        user_agent,
        expires_at,
        utcnow()
    )

    # Update last login
    await db.execute(
        """
        UPDATE admins SET last_login_at = $2, last_login_ip = $3 WHERE id = $1
        """,
        admin["id"],
        utcnow(),
        ip_address
    )

    # Log successful login
    await log_login(True)

    return LoginResponse(
        access_token=jwt_token,
        admin_id=str(admin["id"]),
        nickname=admin["nickname"] or admin["email"],
        roles=role_names,
        expires_at=expires_at
    )


@router.post("/logout")
async def admin_logout(
    admin: dict = Depends(get_current_admin),
    token: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Connection = Depends(get_db)
):
    """Admin logout."""
    # Mark sessions as inactive
    await db.execute(
        """
        UPDATE admin_sessions SET is_active = false
        WHERE admin_id = $1
        """,
        admin["id"]
    )

    return {"success": True}


@router.get("/me", response_model=AdminInfo)
async def get_me(
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get current admin info."""
    permissions = await get_admin_permissions(admin["id"], db)

    return AdminInfo(
        id=admin["id"],
        email=admin["email"],
        nickname=admin["nickname"],
        is_super_admin=admin["is_super_admin"],
        roles=admin["roles"],
        permissions=permissions
    )


@router.get("/check-permission/{permission_code}")
async def check_permission_endpoint(
    permission_code: str,
    admin: dict = Depends(get_current_admin),
    db: asyncpg.Connection = Depends(get_db)
):
    """Check if current admin has permission."""
    return {
        "has_permission": True,
        "admin_id": admin["id"],
        "permission": permission_code
    }


# ============ Admin Management ============

@router.get("/admins")
async def list_admins(
    admin: dict = Depends(_require_admin_view),
    db: asyncpg.Connection = Depends(get_db)
):
    """List all admins (requires admin.manage permission)."""
    admins = await db.fetch(
        """
        SELECT a.id, a.email, a.nickname, a.is_super_admin, a.is_active, a.last_login_at, a.created_at,
               array_agg(r.name) as roles
        FROM admins a
        LEFT JOIN admin_role_assignments ara ON a.id = ara.admin_id
        LEFT JOIN admin_roles r ON ara.role_id = r.id
        GROUP BY a.id
        ORDER BY a.created_at DESC
        """
    )

    return {
        "admins": [
            {
                "id": str(a["id"]),
                "email": a["email"],
                "nickname": a["nickname"],
                "is_super_admin": a["is_super_admin"],
                "is_active": a["is_active"],
                "roles": a["roles"] or [],
                "last_login_at": a["last_login_at"].isoformat() if a["last_login_at"] else None,
                "created_at": a["created_at"].isoformat()
            }
            for a in admins
        ]
    }


@router.post("/admins")
async def create_admin(
    body: AdminCreate,
    admin: dict = Depends(_require_admin_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Create new admin."""
    # Check email uniqueness
    existing = await db.fetchval(
        "SELECT id FROM admins WHERE email = $1",
        body.email
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Create admin
    password_hash = hash_password(body.password)
    admin_id = await db.fetchval(
        """
        INSERT INTO admins (email, password_hash, nickname, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id
        """,
        body.email,
        password_hash,
        body.nickname
    )

    # Assign roles
    for role_name in body.roles:
        role_id = await db.fetchval(
            "SELECT id FROM admin_roles WHERE name = $1",
            role_name
        )
        if role_id:
            await db.execute(
                """
                INSERT INTO admin_role_assignments (admin_id, role_id, assigned_by, assigned_at)
                VALUES ($1, $2, $3, $4)
                """,
                admin_id,
                role_id,
                admin["id"],
                utcnow()
            )

    # Log action
    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'admin.create', $2, $3, $4)
        """,
        admin["id"],
        str(admin_id),
        f"Created admin: {body.email}",
        utcnow()
    )

    return {"success": True, "admin_id": str(admin_id)}


@router.put("/admins/{target_admin_id}/roles")
async def update_admin_roles(
    target_admin_id: str,
    body: RoleAssignment,
    admin: dict = Depends(_require_admin_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Update admin roles."""
    # Cannot modify super admin roles unless you are super admin
    target_is_super = await db.fetchval(
        "SELECT is_super_admin FROM admins WHERE id = $1",
        target_admin_id
    )
    if target_is_super and not admin["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Cannot modify super admin roles")

    # Remove existing roles
    await db.execute(
        "DELETE FROM admin_role_assignments WHERE admin_id = $1",
        target_admin_id
    )

    # Assign new roles
    for role_name in body.roles:
        role_id = await db.fetchval(
            "SELECT id FROM admin_roles WHERE name = $1",
            role_name
        )
        if role_id:
            await db.execute(
                """
                INSERT INTO admin_role_assignments (admin_id, role_id, assigned_by, assigned_at)
                VALUES ($1, $2, $3, $4)
                """,
                target_admin_id,
                role_id,
                admin["id"],
                utcnow()
            )

    return {"success": True}


@router.post("/admins/{target_admin_id}/disable")
async def disable_admin(
    target_admin_id: str,
    admin: dict = Depends(_require_admin_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Disable admin account."""
    # Cannot disable super admin unless you are super admin
    target_is_super = await db.fetchval(
        "SELECT is_super_admin FROM admins WHERE id = $1",
        target_admin_id
    )
    if target_is_super and not admin["is_super_admin"]:
        raise HTTPException(status_code=403, detail="Cannot disable super admin")

    await db.execute(
        "UPDATE admins SET is_active = false WHERE id = $1",
        target_admin_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'admin.disable', $2, '禁用管理员', $3)
        """,
        admin["id"],
        target_admin_id,
        utcnow()
    )

    return {"success": True}


@router.post("/admins/{target_admin_id}/enable")
async def enable_admin(
    target_admin_id: str,
    admin: dict = Depends(_require_admin_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Enable admin account."""
    await db.execute(
        "UPDATE admins SET is_active = true WHERE id = $1",
        target_admin_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'admin.enable', $2, '启用管理员', $3)
        """,
        admin["id"],
        target_admin_id,
        utcnow()
    )

    return {"success": True}


@router.delete("/admins/{target_admin_id}")
async def delete_admin(
    target_admin_id: str,
    admin: dict = Depends(_require_admin_manage),
    db: asyncpg.Connection = Depends(get_db)
):
    """Delete admin account."""
    # Cannot delete super admin
    target_is_super = await db.fetchval(
        "SELECT is_super_admin FROM admins WHERE id = $1",
        target_admin_id
    )
    if target_is_super:
        raise HTTPException(status_code=403, detail="Cannot delete super admin")

    await db.execute(
        "DELETE FROM admins WHERE id = $1",
        target_admin_id
    )

    await db.execute(
        """
        INSERT INTO admin_logs (admin_id, action, target, details, created_at)
        VALUES ($1, 'admin.delete', $2, '删除管理员', $3)
        """,
        admin["id"],
        target_admin_id,
        utcnow()
    )

    return {"success": True}


# ============ Login Logs ============

@router.get("/login-logs")
async def get_login_logs(
    days: int = Query(7, le=30),
    admin: dict = Depends(_require_admin_logs),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get login logs."""
    start_date = utcnow() - timedelta(days=days)

    logs = await db.fetch(
        """
        SELECT ll.id, ll.email, ll.ip_address, ll.success, ll.failure_reason, ll.created_at,
               a.nickname
        FROM login_logs ll
        LEFT JOIN admins a ON ll.admin_id = a.id
        WHERE ll.created_at >= $1
        ORDER BY ll.created_at DESC
        LIMIT 100
        """,
        start_date
    )

    return {
        "logs": [
            {
                "id": str(l["id"]),
                "email": l["email"],
                "nickname": l["nickname"],
                "ip_address": l["ip_address"],
                "success": l["success"],
                "failure_reason": l["failure_reason"],
                "created_at": l["created_at"].isoformat()
            }
            for l in logs
        ]
    }


# ============ Roles & Permissions ============

@router.get("/roles")
async def list_roles(
    db: asyncpg.Connection = Depends(get_db)
):
    """List all roles."""
    roles = await db.fetch(
        """
        SELECT r.id, r.name, r.description,
               array_agg(ap.code) as permissions
        FROM admin_roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN admin_permissions ap ON rp.permission_id = ap.id
        GROUP BY r.id
        ORDER BY r.name
        """
    )

    return {
        "roles": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "description": r["description"],
                "permissions": r["permissions"] or []
            }
            for r in roles
        ]
    }


@router.get("/permissions")
async def list_permissions(
    db: asyncpg.Connection = Depends(get_db)
):
    """List all permissions."""
    permissions = await db.fetch(
        """
        SELECT id, code, name, description, category
        FROM admin_permissions
        ORDER BY category, code
        """
    )

    return {
        "permissions": [
            {
                "id": str(p["id"]),
                "code": p["code"],
                "name": p["name"],
                "description": p["description"],
                "category": p["category"]
            }
            for p in permissions
        ]
    }