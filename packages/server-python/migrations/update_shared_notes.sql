-- 更新 shared_notes 表，添加付费笔记和评分相关字段
-- 日期: 2026-05-31

-- 添加可见性字段（替代 is_public）
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

-- 更新现有数据：将 is_public=true 的记录设为 visibility='public'
UPDATE shared_notes SET visibility = 'public' WHERE is_public = true AND visibility IS NULL;
UPDATE shared_notes SET visibility = 'matched' WHERE is_public = false AND visibility IS NULL;

-- 添加价格字段
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;

-- 添加标签字段
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';

-- 添加评分字段
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- 添加购买次数字段
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;

-- 添加状态字段
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';

-- 创建索引
CREATE INDEX IF NOT EXISTS ix_shared_notes_visibility ON shared_notes(visibility);
CREATE INDEX IF NOT EXISTS ix_shared_notes_status ON shared_notes(status);

-- 创建笔记购买记录表
CREATE TABLE IF NOT EXISTS note_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    author_reward INTEGER NOT NULL,
    platform_fee INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, note_id)
);

CREATE INDEX IF NOT EXISTS ix_note_purchases_user ON note_purchases(user_id);
CREATE INDEX IF NOT EXISTS ix_note_purchases_note ON note_purchases(note_id);

-- 创建笔记评分表
CREATE TABLE IF NOT EXISTS note_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, note_id)
);

CREATE INDEX IF NOT EXISTS ix_note_ratings_user ON note_ratings(user_id);
CREATE INDEX IF NOT EXISTS ix_note_ratings_note ON note_ratings(note_id);

-- 删除旧的 is_public 列（可选，保留以兼容旧代码）
-- ALTER TABLE shared_notes DROP COLUMN IF EXISTS is_public;
