-- Add pending_outlines column to stages table
-- This column stores scene outlines for later creation

ALTER TABLE stages ADD COLUMN IF NOT EXISTS pending_outlines JSONB DEFAULT NULL;

-- Comment on the column
COMMENT ON COLUMN stages.pending_outlines IS '待创建的场景大纲列表，JSON格式，包含title、type、description、key_points等字段';