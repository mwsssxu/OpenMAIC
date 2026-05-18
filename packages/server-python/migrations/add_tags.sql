-- Add tags column to stages table
-- This column stores course category tags as JSONB array

ALTER TABLE stages ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Comment on the column
COMMENT ON COLUMN stages.tags IS '课程分类标签，JSON数组格式，如：["数据科学", "Python", "可视化"]';

-- Add generated_agent_configs column if not exists (for completeness)
ALTER TABLE stages ADD COLUMN IF NOT EXISTS generated_agent_configs JSONB DEFAULT NULL;