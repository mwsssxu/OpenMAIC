-- mistake_records: 错题本（每日复习核心数据源）
--
-- 设计原则：
-- 1. 写时打散：每次提交 assessment 时把错题打散存入，不再依赖 learning_assessments JSON
-- 2. 唯一约束：(user_id, question_id) 多次错只更新 attempt_count 而非新增行
-- 3. 掌握状态：mastered=true 表示用户已通过复习答对，从复习池中移除
-- 4. 复习节奏：next_review_at 用简单梯度（首错 1 天后；再答错重置；答对延长）
--
-- 与 review_schedules / review_records 的区别：
-- - 那两张表面向"课程级复习提醒"（提醒回顾整个课程），从未启用
-- - 本表面向"题目级错题复习"，颗粒度更细，是日活转化器

CREATE TABLE IF NOT EXISTS mistake_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID,
    assessment_id UUID,            -- 出处（最新一次错题来自哪场测评）
    question_id VARCHAR(64) NOT NULL,  -- 题目稳定 ID（来自 questions JSON 中的 id）
    question_snapshot JSONB NOT NULL,  -- 题目快照（含 stem/options/correct_answer/explanation）
    user_last_answer TEXT,         -- 用户最近一次错答内容
    attempt_count INTEGER NOT NULL DEFAULT 1,        -- 总尝试次数
    wrong_count INTEGER NOT NULL DEFAULT 1,          -- 累计错答次数
    correct_streak INTEGER NOT NULL DEFAULT 0,       -- 连续答对次数（≥2 视为掌握）
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    mastered_at TIMESTAMP,
    next_review_at TIMESTAMP NOT NULL DEFAULT NOW(),  -- 下次到期时间
    last_reviewed_at TIMESTAMP,
    first_wrong_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mistake_user_due
    ON mistake_records (user_id, mastered, next_review_at)
    WHERE mastered = FALSE;

CREATE INDEX IF NOT EXISTS idx_mistake_user_course
    ON mistake_records (user_id, course_id);

COMMENT ON TABLE mistake_records IS '错题本，每日复习的数据源';
COMMENT ON COLUMN mistake_records.next_review_at IS '到期时间（小于 NOW() 即出现在今日复习池）';
COMMENT ON COLUMN mistake_records.correct_streak IS '连续答对 2 次视为掌握';
