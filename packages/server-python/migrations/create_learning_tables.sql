-- 学习打卡和成就系统表
-- 执行时间: 2026-06-02

-- ==================== 1. 每日打卡表 ====================
CREATE TABLE IF NOT EXISTS daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    streak_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, checkin_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(checkin_date);

-- ==================== 2. 用户成就表 ====================
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL,
    progress INTEGER DEFAULT 0,
    earned_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned ON user_achievements(earned_at);

-- ==================== 3. 课程完成记录表（如果不存在） ====================
CREATE TABLE IF NOT EXISTS course_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    completion_status VARCHAR(20) DEFAULT 'in_progress',
    time_spent_minutes INTEGER DEFAULT 0,
    scenes_completed INTEGER DEFAULT 0,
    total_scenes INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    rating INTEGER,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_course_completions_user_id ON course_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_course_completions_course_id ON course_completions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_completions_status ON course_completions(completion_status);
CREATE INDEX IF NOT EXISTS idx_course_completions_date ON course_completions(completed_at);

-- ==================== 4. 用户表补充字段 ====================
-- 添加连续打卡相关字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(current_streak);

-- ==================== 注释 ====================
COMMENT ON TABLE daily_checkins IS '每日学习打卡记录';
COMMENT ON TABLE user_achievements IS '用户获得的成就徽章';
COMMENT ON TABLE course_completions IS '课程学习进度和完成记录';

COMMENT ON COLUMN daily_checkins.streak_count IS '当前连续打卡天数';
COMMENT ON COLUMN user_achievements.achievement_id IS '成就ID，如 streak_7, courses_5';
COMMENT ON COLUMN course_completions.completion_status IS '状态：in_progress, completed';