"""Enterprise Module - 企业功能模块

企业客户服务：
1. 企业账户管理（创建、配置）
2. 团队成员邀请与管理
3. 企业课程共享与分配
4. 企业学习数据统计报表
5. 企业专属内容库
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
import asyncpg
import uuid
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/enterprise", tags=["enterprise"])


# ============ Models ============

class EnterpriseCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    size: Optional[str] = None  # small, medium, large
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    plan_type: str = "basic"  # basic, pro, enterprise


class EnterpriseMemberInvite(BaseModel):
    enterprise_id: str
    emails: List[EmailStr]
    role: str = "member"  # admin, member, viewer


class EnterpriseCourseAssign(BaseModel):
    enterprise_id: str
    course_ids: List[str]
    assign_to_all: bool = True
    deadline: Optional[datetime] = None


# ============ Enterprise Management ============

@router.post("/")
async def create_enterprise(
    request: EnterpriseCreate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建企业账户"""
    user_uuid = uuid.UUID(user_id)

    # 检查用户是否已有企业
    existing = await db.fetchrow(
        """
        SELECT id FROM enterprises WHERE owner_id = $1
        """,
        user_uuid
    )

    if existing:
        raise HTTPException(status_code=400, detail="已拥有企业账户")

    # 根据套餐设置限额
    limits = {
        "basic": {"members": 10, "courses": 50, "storage": 100},
        "pro": {"members": 50, "courses": 200, "storage": 500},
        "enterprise": {"members": 200, "courses": 1000, "storage": 2000}
    }

    plan_limits = limits.get(request.plan_type, limits["basic"])

    enterprise_id = uuid.uuid4()

    await db.execute(
        """
        INSERT INTO enterprises
        (id, name, owner_id, industry, size, contact_email, contact_phone,
         plan_type, member_limit, course_limit, storage_limit, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)
        """,
        enterprise_id, request.name, user_uuid, request.industry, request.size,
        request.contact_email, request.contact_phone, request.plan_type,
        plan_limits["members"], plan_limits["courses"], plan_limits["storage"],
        utcnow()
    )

    # 添加创建者为企业管理员
    await db.execute(
        """
        INSERT INTO enterprise_members
        (id, enterprise_id, user_id, role, joined_at, created_at)
        VALUES ($1, $2, $3, 'admin', $4, $4)
        """,
        uuid.uuid4(), enterprise_id, user_uuid, utcnow()
    )

    return {
        "enterprise_id": str(enterprise_id),
        "name": request.name,
        "plan_type": request.plan_type,
        "limits": plan_limits,
        "message": "企业账户创建成功"
    }


@router.get("/my")
async def get_my_enterprise(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取我的企业信息"""
    user_uuid = uuid.UUID(user_id)

    # 获取用户所属企业
    membership = await db.fetchrow(
        """
        SELECT em.enterprise_id, em.role, e.name, e.industry, e.size, e.plan_type,
               e.member_count, e.member_limit, e.course_limit, e.storage_used, e.storage_limit
        FROM enterprise_members em
        JOIN enterprises e ON e.id = em.enterprise_id
        WHERE em.user_id = $1 AND e.status = 'active'
        """,
        user_uuid
    )

    if not membership:
        return {"has_enterprise": False}

    return {
        "has_enterprise": True,
        "enterprise_id": str(membership["enterprise_id"]),
        "name": membership["name"],
        "industry": membership["industry"],
        "size": membership["size"],
        "plan_type": membership["plan_type"],
        "role": membership["role"],
        "member_count": membership["member_count"] or 0,
        "member_limit": membership["member_limit"],
        "course_limit": membership["course_limit"],
        "storage_used": membership["storage_used"] or 0,
        "storage_limit": membership["storage_limit"]
    }


@router.get("/{enterprise_id}")
async def get_enterprise_detail(
    enterprise_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取企业详情"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证用户是企业成员
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership:
        raise HTTPException(status_code=403, detail="无权访问企业信息")

    enterprise = await db.fetchrow(
        """
        SELECT id, name, industry, size, contact_email, contact_phone,
               plan_type, member_count, member_limit, course_count, course_limit,
               storage_used, storage_limit, subscription_ends_at, created_at
        FROM enterprises WHERE id = $1
        """,
        ent_uuid
    )

    return {
        "id": str(enterprise["id"]),
        "name": enterprise["name"],
        "industry": enterprise["industry"],
        "size": enterprise["size"],
        "contact_email": enterprise["contact_email"],
        "plan_type": enterprise["plan_type"],
        "member_count": enterprise["member_count"] or 0,
        "member_limit": enterprise["member_limit"],
        "course_count": enterprise["course_count"] or 0,
        "course_limit": enterprise["course_limit"],
        "storage_used": enterprise["storage_used"] or 0,
        "storage_limit": enterprise["storage_limit"],
        "subscription_ends_at": enterprise["subscription_ends_at"].isoformat() if enterprise["subscription_ends_at"] else None,
        "created_at": enterprise["created_at"].isoformat(),
        "my_role": membership["role"]
    }


# ============ Member Management ============

@router.post("/{enterprise_id}/members/invite")
async def invite_members(
    enterprise_id: str,
    request: EnterpriseMemberInvite,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """邀请团队成员"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证管理员权限
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership or membership["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="只有管理员可以邀请成员")

    # 检查成员限制
    enterprise = await db.fetchrow(
        """
        SELECT member_count, member_limit FROM enterprises WHERE id = $1
        """,
        ent_uuid
    )

    pending_invites = await db.fetchval(
        """
        SELECT COUNT(*) FROM enterprise_invites
        WHERE enterprise_id = $1 AND status = 'pending'
        """,
        ent_uuid
    ) or 0

    total = (enterprise["member_count"] or 0) + pending_invites + len(request.emails)
    if total > enterprise["member_limit"]:
        raise HTTPException(status_code=400, detail=f"成员数量超出限制（最多{enterprise['member_limit']}人）")

    invites_created = []

    for email in request.emails:
        # 检查是否已有用户
        existing_user = await db.fetchrow(
            """
            SELECT id FROM users WHERE email = $1
            """,
            email
        )

        # 检查是否已邀请
        existing_invite = await db.fetchrow(
            """
            SELECT id FROM enterprise_invites
            WHERE enterprise_id = $1 AND email = $2 AND status = 'pending'
            """,
            ent_uuid, email
        )

        if existing_invite:
            continue

        # 检查是否已是成员
        if existing_user:
            existing_member = await db.fetchrow(
                """
                SELECT id FROM enterprise_members
                WHERE enterprise_id = $1 AND user_id = $2
                """,
                ent_uuid, existing_user["id"]
            )
            if existing_member:
                continue

        # 创建邀请
        invite_id = uuid.uuid4()
        invite_code = uuid.uuid4().hex[:12]

        await db.execute(
            """
            INSERT INTO enterprise_invites
            (id, enterprise_id, email, role, invite_code, invited_by, expires_at, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            """,
            invite_id, ent_uuid, email, request.role, invite_code,
            user_uuid, utcnow() + timedelta(days=7), utcnow()
        )

        invites_created.append({
            "email": email,
            "invite_code": invite_code,
            "expires_in_days": 7
        })

    return {
        "enterprise_id": str(ent_uuid),
        "invites_created": invites_created,
        "total_invited": len(invites_created),
        "message": f"成功邀请 {len(invites_created)} 人"
    }


@router.get("/{enterprise_id}/members")
async def list_members(
    enterprise_id: str,
    role: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取团队成员列表"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证成员身份
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership:
        raise HTTPException(status_code=403, detail="无权查看成员")

    offset = (page - 1) * limit

    conditions = ["em.enterprise_id = $1"]
    params = [ent_uuid]

    if role:
        conditions.append(f"em.role = ${len(params) + 1}")
        params.append(role)

    params.extend([limit, offset])

    members = await db.fetch(
        f"""
        SELECT em.id, em.user_id, em.role, em.joined_at, em.last_active_at,
               u.email, u.nickname, u.avatar_url
        FROM enterprise_members em
        JOIN users u ON u.id = em.user_id
        WHERE {' AND '.join(conditions)}
        ORDER BY em.joined_at DESC
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params
    )

    return {
        "members": [
            {
                "member_id": str(m["id"]),
                "user_id": str(m["user_id"]),
                "email": m["email"],
                "nickname": m["nickname"],
                "avatar_url": m["avatar_url"],
                "role": m["role"],
                "joined_at": m["joined_at"].isoformat(),
                "last_active_at": m["last_active_at"].isoformat() if m["last_active_at"] else None
            }
            for m in members
        ],
        "pagination": {"page": page, "limit": limit}
    }


@router.post("/{enterprise_id}/members/{member_id}/role")
async def update_member_role(
    enterprise_id: str,
    member_id: str,
    body: dict,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新成员角色"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)
    member_uuid = uuid.UUID(member_id)

    new_role = body.get("role")
    if new_role not in ["admin", "member", "viewer"]:
        raise HTTPException(status_code=400, detail="无效的角色")

    # 验证管理员权限
    admin_membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not admin_membership or admin_membership["role"] != "admin":
        raise HTTPException(status_code=403, detail="只有管理员可以修改角色")

    # 不能修改owner角色
    target_membership = await db.fetchrow(
        """
        SELECT role, user_id FROM enterprise_members WHERE id = $1
        """,
        member_uuid
    )

    if not target_membership:
        raise HTTPException(status_code=404, detail="成员不存在")

    if target_membership["role"] == "owner":
        raise HTTPException(status_code=403, detail="不能修改owner角色")

    await db.execute(
        """
        UPDATE enterprise_members SET role = $2 WHERE id = $1
        """,
        member_uuid, new_role
    )

    return {"member_id": str(member_uuid), "new_role": new_role}


@router.delete("/{enterprise_id}/members/{member_id}")
async def remove_member(
    enterprise_id: str,
    member_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """移除团队成员"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)
    member_uuid = uuid.UUID(member_id)

    # 验证管理员权限
    admin_membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not admin_membership or admin_membership["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="只有管理员可以移除成员")

    # 不能移除owner
    target_membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members WHERE id = $1
        """,
        member_uuid
    )

    if not target_membership:
        raise HTTPException(status_code=404, detail="成员不存在")

    if target_membership["role"] == "owner":
        raise HTTPException(status_code=403, detail="不能移除owner")

    await db.execute(
        """
        DELETE FROM enterprise_members WHERE id = $1
        """,
        member_uuid
    )

    # 更新成员计数
    await db.execute(
        """
        UPDATE enterprises SET member_count = member_count - 1 WHERE id = $1
        """,
        ent_uuid
    )

    return {"message": "成员已移除"}


# ============ Course Management ============

@router.post("/{enterprise_id}/courses/assign")
async def assign_courses(
    enterprise_id: str,
    request: EnterpriseCourseAssign,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """分配企业课程"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证管理员权限
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership or membership["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="只有管理员可以分配课程")

    # 检查课程限制
    enterprise = await db.fetchrow(
        """
        SELECT course_count, course_limit FROM enterprises WHERE id = $1
        """,
        ent_uuid
    )

    if enterprise["course_count"] + len(request.course_ids) > enterprise["course_limit"]:
        raise HTTPException(status_code=400, detail="课程数量超出限制")

    assignments_created = []

    for course_id in request.course_ids:
        course_uuid = uuid.UUID(course_id)

        # 验证课程存在
        course = await db.fetchrow(
            """
            SELECT id, name FROM stages WHERE id = $1
            """,
            course_uuid
        )

        if not course:
            continue

        # 添加企业课程
        existing = await db.fetchrow(
            """
            SELECT id FROM enterprise_courses
            WHERE enterprise_id = $1 AND course_id = $2
            """,
            ent_uuid, course_uuid
        )

        if existing:
            continue

        assignment_id = uuid.uuid4()

        await db.execute(
            """
            INSERT INTO enterprise_courses
            (id, enterprise_id, course_id, assigned_by, assigned_at,
             is_required, deadline, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $5)
            """,
            assignment_id, ent_uuid, course_uuid, user_uuid, utcnow(),
            request.assign_to_all, request.deadline
        )

        assignments_created.append({
            "course_id": str(course_uuid),
            "course_name": course["name"],
            "is_required": request.assign_to_all
        })

    # 更新课程计数
    await db.execute(
        """
        UPDATE enterprises SET course_count = course_count + $2 WHERE id = $1
        """,
        ent_uuid, len(assignments_created)
    )

    return {
        "enterprise_id": str(ent_uuid),
        "assignments_created": assignments_created,
        "total_assigned": len(assignments_created),
        "message": f"成功分配 {len(assignments_created)} 门课程"
    }


@router.get("/{enterprise_id}/courses")
async def list_enterprise_courses(
    enterprise_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取企业课程列表"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证成员身份
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership:
        raise HTTPException(status_code=403, detail="无权查看课程")

    courses = await db.fetch(
        """
        SELECT ec.id, ec.course_id, ec.is_required, ec.deadline, ec.assigned_at,
               s.name, s.description, ec.status
        FROM enterprise_courses ec
        JOIN stages s ON s.id = ec.course_id
        WHERE ec.enterprise_id = $1 AND ec.status = 'active'
        ORDER BY ec.assigned_at DESC
        """,
        ent_uuid
    )

    return {
        "courses": [
            {
                "assignment_id": str(c["id"]),
                "course_id": str(c["course_id"]),
                "course_name": c["name"],
                "description": c["description"],
                "is_required": c["is_required"],
                "deadline": c["deadline"].isoformat() if c["deadline"] else None,
                "assigned_at": c["assigned_at"].isoformat(),
                "status": c["status"]
            }
            for c in courses
        ]
    }


# ============ Statistics ============

@router.get("/{enterprise_id}/stats")
async def get_enterprise_stats(
    enterprise_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取企业学习统计"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证成员身份
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership:
        raise HTTPException(status_code=403, detail="无权查看统计")

    # 成员统计
    member_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM enterprise_members WHERE enterprise_id = $1
        """,
        ent_uuid
    )

    # 活跃成员（本周）
    active_members = await db.fetchval(
        """
        SELECT COUNT(DISTINCT em.user_id)
        FROM enterprise_members em
        JOIN course_completions cc ON cc.user_id = em.user_id
        WHERE em.enterprise_id = $1 AND cc.completed_at >= NOW() - INTERVAL '7 days'
        """,
        ent_uuid
    ) or 0

    # 课程完成统计
    course_completions = await db.fetchval(
        """
        SELECT COUNT(*) FROM enterprise_course_completions ecc
        WHERE ecc.enterprise_id = $1
        """,
        ent_uuid
    ) or 0

    # 总学习时长
    total_hours = await db.fetchval(
        """
        SELECT COALESCE(SUM(time_spent_minutes), 0) / 60.0
        FROM enterprise_course_completions ecc
        WHERE ecc.enterprise_id = $1
        """,
        ent_uuid
    ) or 0

    # 平均完成率
    avg_completion = await db.fetchval(
        """
        SELECT AVG(completion_rate) FROM enterprise_course_progress
        WHERE enterprise_id = $1
        """,
        ent_uuid
    ) or 0

    return {
        "enterprise_id": str(ent_uuid),
        "member_count": member_count or 0,
        "active_members": active_members,
        "course_completions": course_completions,
        "total_learning_hours": round(total_hours, 1),
        "avg_completion_rate": round(avg_completion, 1),
        "activity_rate": round(active_members / max(member_count or 1, 1) * 100, 1)
    }


@router.get("/{enterprise_id}/reports/learning")
async def get_learning_report(
    enterprise_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取学习报表"""
    user_uuid = uuid.UUID(user_id)
    ent_uuid = uuid.UUID(enterprise_id)

    # 验证管理员权限
    membership = await db.fetchrow(
        """
        SELECT role FROM enterprise_members
        WHERE enterprise_id = $1 AND user_id = $2
        """,
        ent_uuid, user_uuid
    )

    if not membership or membership["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="只有管理员可以查看报表")

    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else utcnow() - timedelta(days=30)
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else utcnow()

    # 每日学习统计
    daily_stats = await db.fetch(
        """
        SELECT DATE(ecc.completed_at) as date,
               COUNT(*) as completions,
               SUM(ecc.time_spent_minutes) as total_minutes
        FROM enterprise_course_completions ecc
        WHERE ecc.enterprise_id = $1
        AND ecc.completed_at >= $2 AND ecc.completed_at <= $3
        GROUP BY DATE(ecc.completed_at)
        ORDER BY date
        """,
        ent_uuid, start, end
    )

    # 成员学习排名
    member_ranking = await db.fetch(
        """
        SELECT em.user_id, u.nickname, u.email,
               COUNT(ecc.id) as completions,
               SUM(ecc.time_spent_minutes) as total_minutes
        FROM enterprise_members em
        JOIN users u ON u.id = em.user_id
        LEFT JOIN enterprise_course_completions ecc
        ON ecc.user_id = em.user_id AND ecc.enterprise_id = $1
        AND ecc.completed_at >= $2 AND ecc.completed_at <= $3
        WHERE em.enterprise_id = $1
        GROUP BY em.user_id, u.nickname, u.email
        ORDER BY completions DESC, total_minutes DESC
        LIMIT 20
        """,
        ent_uuid, start, end
    )

    return {
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat()
        },
        "daily_stats": [
            {
                "date": str(s["date"]),
                "completions": s["completions"] or 0,
                "total_minutes": s["total_minutes"] or 0
            }
            for s in daily_stats
        ],
        "member_ranking": [
            {
                "user_id": str(m["user_id"]),
                "nickname": m["nickname"],
                "email": m["email"],
                "completions": m["completions"] or 0,
                "total_minutes": m["total_minutes"] or 0
            }
            for m in member_ranking
        ]
    }