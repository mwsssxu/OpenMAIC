"""Mistake tracking service — 错题本核心逻辑

设计：
- 题目级颗粒度（vs review_schedules 的课程级）
- 自然遗忘曲线：1天/3天/7天/14天 梯度
- 答对 2 次连续即"掌握"，从复习池退出
- 答错时 streak 清零，next_review_at 重置为 1 天后

写入路径：assessment 提交、scene quiz、programming（未来扩展）。
"""
from __future__ import annotations
import json
import uuid
from datetime import timedelta
from typing import Any, List, Optional
import asyncpg
from app.core.time_utils import utcnow


# 答对后的"间隔节奏"——掌握度越高，下次到期越远
REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30]


async def record_mistakes_from_assessment(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
    course_id: Optional[uuid.UUID],
    assessment_id: uuid.UUID,
    questions: List[dict],
    answers: List[dict],
) -> int:
    """从一次 assessment 提交中提取错题、写入 mistake_records。

    返回新增/更新的错题条数。
    """
    # 把 user 答案按 question_id 索引
    answer_map = {a["question_id"]: a.get("answer") for a in answers}

    n_recorded = 0
    for q in questions:
        qid = q.get("id")
        if not qid:
            continue
        user_ans = answer_map.get(qid)
        correct_answer = q.get("correct_answer") if q.get("correct_answer") is not None else q.get("answer")
        is_wrong = user_ans != correct_answer
        if not is_wrong:
            continue

        # 题目快照（精简版，去掉无关字段）
        snapshot = {
            "id": qid,
            "type": q.get("type"),
            "content": q.get("content") or q.get("stem") or q.get("question"),
            "options": q.get("options"),
            "correct_answer": correct_answer,
            "explanation": q.get("explanation") or q.get("analysis"),
            "difficulty": q.get("difficulty"),
            "points": q.get("points", 1),
        }

        # UPSERT：已有记录则累加错题计数 + 重置到期/streak
        # next_review_at 设为 NOW()——刚错的题立刻进入今日复习池（趁热打铁）
        await db.execute(
            """
            INSERT INTO mistake_records (
                id, user_id, course_id, assessment_id, question_id,
                question_snapshot, user_last_answer,
                attempt_count, wrong_count, correct_streak,
                mastered, next_review_at, first_wrong_at,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7,
                    1, 1, 0, FALSE, $8, $8, $8, $8)
            ON CONFLICT (user_id, question_id) DO UPDATE SET
                attempt_count = mistake_records.attempt_count + 1,
                wrong_count = mistake_records.wrong_count + 1,
                correct_streak = 0,
                mastered = FALSE,
                mastered_at = NULL,
                user_last_answer = EXCLUDED.user_last_answer,
                question_snapshot = EXCLUDED.question_snapshot,
                assessment_id = EXCLUDED.assessment_id,
                next_review_at = EXCLUDED.next_review_at,
                updated_at = EXCLUDED.updated_at
            """,
            uuid.uuid4(), user_id, course_id, assessment_id, str(qid),
            json.dumps(snapshot), str(user_ans) if user_ans is not None else None,
            utcnow(),
        )
        n_recorded += 1

    return n_recorded


async def fetch_due_mistakes(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
    limit: int = 10,
) -> List[dict]:
    """拉取当前用户到期且未掌握的错题（按到期早→错次多排序）。"""
    rows = await db.fetch(
        """
        SELECT id, course_id, question_id, question_snapshot,
               attempt_count, wrong_count, correct_streak,
               next_review_at, last_reviewed_at, first_wrong_at
        FROM mistake_records
        WHERE user_id = $1
          AND mastered = FALSE
          AND next_review_at <= $2
        ORDER BY next_review_at ASC, wrong_count DESC
        LIMIT $3
        """,
        user_id, utcnow(), limit,
    )
    out: List[dict] = []
    for r in rows:
        snapshot = r["question_snapshot"]
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        out.append({
            "id": str(r["id"]),
            "course_id": str(r["course_id"]) if r["course_id"] else None,
            "question_id": r["question_id"],
            "question": snapshot,
            "attempt_count": r["attempt_count"],
            "wrong_count": r["wrong_count"],
            "correct_streak": r["correct_streak"],
            "next_review_at": r["next_review_at"].isoformat() if r["next_review_at"] else None,
            "last_reviewed_at": r["last_reviewed_at"].isoformat() if r["last_reviewed_at"] else None,
        })
    return out


async def submit_review_answer(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
    mistake_id: uuid.UUID,
    answer: str,
) -> dict:
    """用户在复习页提交一次答题。

    - 答对：correct_streak +1；连续答对 2 次 → mastered=True；否则按梯度推迟下次到期
    - 答错：streak 清零，wrong_count +1，next_review_at 重置 1 天后
    """
    row = await db.fetchrow(
        """
        SELECT id, user_id, question_snapshot, correct_streak, wrong_count, attempt_count
        FROM mistake_records WHERE id = $1
        """,
        mistake_id,
    )
    if not row or row["user_id"] != user_id:
        raise ValueError("mistake record not found")

    snapshot = row["question_snapshot"]
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    correct_answer = snapshot.get("correct_answer") if snapshot.get("correct_answer") is not None else snapshot.get("answer")

    # 归一化比较：支持单选（string）和多选（list/comma-separated）
    def _normalize(a: Any) -> str:
        if isinstance(a, list):
            return ",".join(sorted(str(x) for x in a))
        if isinstance(a, str):
            return a.strip()
        return str(a) if a is not None else ""

    # 判断题型：short_answer 或无选项 → 模糊匹配
    q_type = snapshot.get("type", "")
    has_options = bool(snapshot.get("options"))
    is_short = q_type == "short_answer" or (not has_options and not isinstance(correct_answer, list))

    if is_short and isinstance(correct_answer, list) and len(correct_answer) > 0:
        # 问答题关键词匹配：用户答案包含所有关键词则正确
        answer_lower = answer.strip().lower()
        is_correct = all(
            kw.strip().lower() in answer_lower
            for kw in correct_answer
        )
    elif is_short and isinstance(correct_answer, str) and correct_answer:
        # 单个正确答案的问答题：包含即正确
        is_correct = correct_answer.strip().lower() in answer.strip().lower()
    else:
        # 选择题：严格等号（归一化后）
        is_correct = _normalize(answer) == _normalize(correct_answer)

    new_attempt = row["attempt_count"] + 1
    if is_correct:
        new_streak = row["correct_streak"] + 1
        new_wrong = row["wrong_count"]
        if new_streak >= 2:
            await db.execute(
                """
                UPDATE mistake_records
                SET correct_streak = $1, attempt_count = $2,
                    mastered = TRUE, mastered_at = $3,
                    last_reviewed_at = $3, updated_at = $3
                WHERE id = $4
                """,
                new_streak, new_attempt, utcnow(), mistake_id,
            )
            mastered = True
            next_review_at = None
        else:
            # 答对1次：推迟到今天结束（今天内仍可复习），而非1天后
            # 这样用户本轮复习中不会看到题目消失
            today_end = utcnow().replace(hour=23, minute=59, second=59, microsecond=0)
            if today_end <= utcnow():
                today_end = today_end + timedelta(days=1)
            next_review = today_end
            await db.execute(
                """
                UPDATE mistake_records
                SET correct_streak = $1, attempt_count = $2,
                    next_review_at = $3, last_reviewed_at = $4, updated_at = $4
                WHERE id = $5
                """,
                new_streak, new_attempt, next_review, utcnow(), mistake_id,
            )
            mastered = False
            next_review_at = next_review.isoformat()
    else:
        new_streak = 0
        new_wrong = row["wrong_count"] + 1
        next_review = utcnow() + timedelta(days=1)
        await db.execute(
            """
            UPDATE mistake_records
            SET correct_streak = 0, attempt_count = $1, wrong_count = $2,
                next_review_at = $3, last_reviewed_at = $4, updated_at = $4
            WHERE id = $5
            """,
            new_attempt, new_wrong, next_review, utcnow(), mistake_id,
        )
        mastered = False
        next_review_at = next_review.isoformat()

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": snapshot.get("explanation"),
        "mastered": mastered,
        "correct_streak": new_streak,
        "wrong_count": new_wrong,
        "next_review_at": next_review_at,
    }


async def get_review_stats(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
) -> dict:
    """统计：总错题 / 已掌握 / 今日待复习。"""
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE mastered = TRUE) AS mastered_count,
            COUNT(*) FILTER (WHERE mastered = FALSE AND next_review_at <= $2) AS due_count
        FROM mistake_records
        WHERE user_id = $1
        """,
        user_id, utcnow(),
    )
    if row is None:
        return {"total": 0, "mastered_count": 0, "due_count": 0}
    return {
        "total": row["total"] or 0,
        "mastered_count": row["mastered_count"] or 0,
        "due_count": row["due_count"] or 0,
    }
