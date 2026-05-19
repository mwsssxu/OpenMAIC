-- Add personal note fields to shared_notes table
-- Migration: 2025-05-19-personal-notes-fields.sql

-- Add is_personal column (distinguish personal notes from marketplace notes)
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;

-- Add category column (for filtering: '数据分析', 'Python', etc.)
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT NULL;

-- Add starred column (favorite/bookmark)
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;

-- Add color column (for UI styling: 'coral', 'mint', 'gold', 'blue', 'purple')
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL;

-- Add preview column (short preview text for list display)
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS preview TEXT DEFAULT NULL;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_shared_notes_personal ON shared_notes(user_id, is_personal);
CREATE INDEX IF NOT EXISTS idx_shared_notes_starred ON shared_notes(user_id, starred) WHERE is_personal = TRUE;

-- Add user_achievements table if not exists
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL,
    progress INTEGER DEFAULT 0,
    earned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);