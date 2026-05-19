"""
个人学习笔记路由 - 用户自己的学习笔记（非市场共享笔记）
"""

from fastapi import APIRouter, HTTPException, Depends
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
import asyncpg
import uuid
from datetime import datetime, timedelta
from app.core.time_utils import utcnow
from typing import Optional, List

router = APIRouter()


# ==================== 个人笔记 ====================

# ==================== 笔记统计 ====================

@router.get("/stats")
async def get_notes_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取笔记统计信息"""
    user_uuid = uuid.UUID(current_user_id)

    # 总笔记数
    total = await db.fetchval(
        """
        SELECT COUNT(*) FROM shared_notes WHERE user_id = $1 AND is_personal = TRUE
        """,
        user_uuid
    ) or 0

    # 今日笔记数
    today = utcnow().date()
    today_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM shared_notes
        WHERE user_id = $1 AND is_personal = TRUE AND created_at >= $2
        """,
        user_uuid, today
    ) or 0

    # 收藏笔记数
    starred_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM shared_notes WHERE user_id = $1 AND is_personal = TRUE AND starred = TRUE
        """,
        user_uuid
    ) or 0

    return {
        "total_notes": total,
        "today_notes": today_count,
        "starred_notes": starred_count,
    }


@router.get("/")
async def get_personal_notes(
    page: int = 1,
    limit: int = 20,
    filter: str = "all",
    starred_only: bool = False,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取用户的个人笔记列表（按时间分组）"""
    user_uuid = uuid.UUID(current_user_id)
    offset = (page - 1) * limit

    # 计算今天和本周的时间范围
    today = utcnow().date()
    week_start = today - timedelta(days=today.weekday())  # 本周一

    # 构建查询条件
    conditions = ["user_id = $1", "is_personal = TRUE"]
    params = [user_uuid]
    param_idx = 2

    if starred_only:
        conditions.append(f"starred = ${param_idx}")
        params.append(True)
        param_idx += 1

    if filter != "all":
        # 按分类筛选
        conditions.append(f"category = ${param_idx}")
        params.append(filter)
        param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    # 获取笔记列表
    rows = await db.fetch(
        f"""
        SELECT id, title, preview, category, starred, color, created_at, course_id
        FROM shared_notes {where_clause}
        ORDER BY created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params, limit, offset
    )

    # 获取总数
    total = await db.fetchval(
        f"""
        SELECT COUNT(*) FROM shared_notes {where_clause}
        """,
        *params[:-2]  # 不需要 limit 和 offset
    )

    # 按时间分组
    today_notes = []
    week_notes = []

    for row in rows:
        note_date = row["created_at"].date()
        note = {
            "id": str(row["id"]),
            "title": row["title"],
            "preview": row["preview"] or row["title"],
            "category": row["category"] or "学习笔记",
            "starred": row["starred"] or False,
            "color": row["color"] or "coral",
            "time": format_time(row["created_at"]),
            "course_id": str(row["course_id"]) if row["course_id"] else None,
        }

        if note_date == today:
            today_notes.append(note)
        elif note_date >= week_start:
            week_notes.append(note)

    return {
        "today": today_notes,
        "this_week": week_notes,
        "total": total,
        "today_count": len(today_notes),
        "week_count": len(week_notes),
        "pagination": {
            "page": page,
            "limit": limit,
        },
    }


def format_time(dt: datetime) -> str:
    """格式化时间显示"""
    now = utcnow()
    diff = now - dt

    if diff.days == 0:
        hours = diff.seconds // 3600
        if hours < 1:
            minutes = diff.seconds // 60
            return f"{minutes}分钟前"
        return f"{hours}小时前"
    elif diff.days == 1:
        return "昨天"
    elif diff.days < 7:
        weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        return weekdays[dt.weekday()]
    else:
        return dt.strftime("%m-%d")


@router.get("/{note_id}")
async def get_personal_note_detail(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取个人笔记详情"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    note = await db.fetchrow(
        """
        SELECT id, user_id, title, content, course_id, category, starred, color, tags, created_at
        FROM shared_notes WHERE id = $1 AND user_id = $2 AND is_personal = TRUE
        """,
        n_uuid, user_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 获取课程名称
    course_name = None
    if note["course_id"]:
        course = await db.fetchrow(
            "SELECT name FROM stages WHERE id = $1",
            note["course_id"]
        )
        course_name = course["name"] if course else None

    # 获取相关笔记（同一课程）
    related_notes = []
    if note["course_id"]:
        related = await db.fetch(
            """
            SELECT id, title, created_at, color
            FROM shared_notes
            WHERE course_id = $1 AND user_id = $2 AND id != $3 AND is_personal = TRUE
            ORDER BY created_at DESC
            LIMIT 3
            """,
            note["course_id"], user_uuid, n_uuid
        )
        for r in related:
            related_notes.append({
                "id": str(r["id"]),
                "title": r["title"],
                "date": r["created_at"].strftime("%Y-%m-%d"),
                "course": course_name,
                "color": r["color"] or "mint",
            })

    return {
        "id": str(note["id"]),
        "title": note["title"],
        "content": note["content"],
        "course": course_name,
        "course_id": str(note["course_id"]) if note["course_id"] else None,
        "category": note["category"] or "学习笔记",
        "starred": note["starred"] or False,
        "color": note["color"] or "coral",
        "tags": note["tags"].split(",") if note["tags"] else [],
        "created_at": note["created_at"].strftime("%Y-%m-%d %H:%M"),
        "related_notes": related_notes,
    }


@router.post("/")
async def create_personal_note(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建个人学习笔记"""
    user_uuid = uuid.UUID(current_user_id)

    title = body.get("title", "").strip()
    content = body.get("content", "").strip()
    course_id = body.get("course_id")
    category = body.get("category", "学习笔记")
    tags = body.get("tags", [])
    starred = body.get("starred", False)
    color = body.get("color", "coral")

    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")

    note_id = uuid.uuid4()
    preview = content[:100] if content else title

    await db.execute(
        """
        INSERT INTO shared_notes
        (id, user_id, title, content, preview, course_id, visibility, price, tags,
         category, starred, color, is_personal, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'private', 0, $7, $8, $9, $10, TRUE, 'published', $11)
        """,
        note_id, user_uuid, title, content, preview,
        uuid.UUID(course_id) if course_id else None,
        ",".join(tags) if tags else "",
        category, starred, color, utcnow()
    )

    return {
        "id": str(note_id),
        "title": title,
        "message": "笔记创建成功",
    }


@router.post("/{note_id}/star")
async def toggle_note_star(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """切换笔记星标状态"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    # 检查笔记是否属于用户
    note = await db.fetchrow(
        """
        SELECT starred FROM shared_notes WHERE id = $1 AND user_id = $2 AND is_personal = TRUE
        """,
        n_uuid, user_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    new_starred = not note["starred"]

    await db.execute(
        "UPDATE shared_notes SET starred = $1 WHERE id = $2",
        new_starred, n_uuid
    )

    return {
        "note_id": str(n_uuid),
        "starred": new_starred,
        "message": "已收藏" if new_starred else "已取消收藏",
    }


@router.put("/{note_id}")
async def update_personal_note(
    note_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """更新个人笔记"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    # 检查笔记是否属于用户
    note = await db.fetchrow(
        """
        SELECT id FROM shared_notes WHERE id = $1 AND user_id = $2 AND is_personal = TRUE
        """,
        n_uuid, user_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    title = body.get("title")
    content = body.get("content")
    category = body.get("category")
    tags = body.get("tags")
    starred = body.get("starred")
    color = body.get("color")

    update_fields = []
    update_values = []
    param_idx = 1

    if title:
        update_fields.append(f"title = ${param_idx}")
        update_values.append(title.strip())
        param_idx += 1
        update_fields.append(f"preview = ${param_idx}")
        update_values.append(content[:100] if content else title.strip())
        param_idx += 1

    if content:
        update_fields.append(f"content = ${param_idx}")
        update_values.append(content.strip())
        param_idx += 1

    if category:
        update_fields.append(f"category = ${param_idx}")
        update_values.append(category)
        param_idx += 1

    if tags:
        update_fields.append(f"tags = ${param_idx}")
        update_values.append(",".join(tags) if isinstance(tags, list) else tags)
        param_idx += 1

    if starred is not None:
        update_fields.append(f"starred = ${param_idx}")
        update_values.append(starred)
        param_idx += 1

    if color:
        update_fields.append(f"color = ${param_idx}")
        update_values.append(color)
        param_idx += 1

    if not update_fields:
        raise HTTPException(status_code=400, detail="没有更新内容")

    update_fields.append(f"updated_at = ${param_idx}")
    update_values.append(utcnow())
    param_idx += 1

    update_values.append(n_uuid)

    await db.execute(
        f"""
        UPDATE shared_notes SET {", ".join(update_fields)} WHERE id = ${param_idx}
        """,
        *update_values
    )

    return {
        "note_id": str(n_uuid),
        "message": "笔记更新成功",
    }


@router.delete("/{note_id}")
async def delete_personal_note(
    note_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """删除个人笔记"""
    user_uuid = uuid.UUID(current_user_id)
    n_uuid = uuid.UUID(note_id)

    # 检查笔记是否属于用户
    note = await db.fetchrow(
        """
        SELECT id FROM shared_notes WHERE id = $1 AND user_id = $2 AND is_personal = TRUE
        """,
        n_uuid, user_uuid
    )

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    await db.execute(
        "DELETE FROM shared_notes WHERE id = $1",
        n_uuid
    )

    return {
        "note_id": str(n_uuid),
        "message": "笔记删除成功",
    }
        """,
        user_uuid
    ) or 0

    # 今日笔记数
    today = utcnow().date()
    today_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM shared_notes
        WHERE user_id = $1 AND is_personal = TRUE AND created_at >= $2
        """,
        user_uuid, today
    ) or 0

    # 收藏笔记数
    starred_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM shared_notes WHERE user_id = $1 AND is_personal = TRUE AND starred = TRUE
        """,
        user_uuid
    ) or 0

    return {
        "total_notes": total,
        "today_notes": today_count,
        "starred_notes": starred_count,
    }