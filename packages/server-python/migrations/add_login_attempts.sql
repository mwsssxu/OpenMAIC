-- 登录暴力破解保护：记录登录尝试
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 按邮箱+时间查询的索引（用于失败次数统计）
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
    ON login_attempts (email, attempted_at DESC);

-- 自动清理30天前的记录
-- (生产环境建议用 pg_cron 或外部定时任务执行: DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days')