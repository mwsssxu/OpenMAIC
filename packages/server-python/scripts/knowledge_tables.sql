-- 知识库数据表
-- 执行方式: psql -d openmaic -f knowledge_tables.sql

-- 知识卡片表
CREATE TABLE IF NOT EXISTS knowledge_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 基本信息
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    key_points JSONB,  -- 关键知识点数组

    -- 来源追踪
    source_type VARCHAR(50) DEFAULT 'manual' CHECK (source_type IN ('manual', 'course', 'note')),
    source_id UUID,  -- 关联的课程/笔记ID
    scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,

    -- 分类标签
    skill_category VARCHAR(50) DEFAULT 'general' CHECK (skill_category IN ('programming', 'data', 'business', 'language', 'design', 'math', 'science', 'general')),
    tags TEXT,  -- 逗号分隔

    -- 掌握度
    mastery_level INT DEFAULT 1 CHECK (mastery_level >= 1 AND mastery_level <= 5),
    review_count INT DEFAULT 0,
    last_reviewed_at TIMESTAMP,

    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 知识关联表
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_card_id UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    to_card_id UUID NOT NULL REFERENCES knowledge_cards(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'related' CHECK (relation_type IN ('prerequisite', 'related', 'extends')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- 防止重复关联
    UNIQUE(from_card_id, to_card_id),
    -- 防止自关联
    CHECK (from_card_id != to_card_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_user ON knowledge_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_skill ON knowledge_cards(skill_category);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_mastery ON knowledge_cards(mastery_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_scene ON knowledge_cards(scene_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_created ON knowledge_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_user_skill ON knowledge_cards(user_id, skill_category);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_from ON knowledge_relations(from_card_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_to ON knowledge_relations(to_card_id);

-- 更新触发器
CREATE OR REPLACE FUNCTION update_knowledge_card_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_cards_update_trigger
BEFORE UPDATE ON knowledge_cards
FOR EACH ROW EXECUTE FUNCTION update_knowledge_card_timestamp();

-- 注释
COMMENT ON TABLE knowledge_cards IS '用户个人知识卡片，支持AI提取和手动创建';
COMMENT ON TABLE knowledge_relations IS '知识卡片之间的关联关系';
COMMENT ON COLUMN knowledge_cards.mastery_level IS '掌握度：1-初学, 2-了解, 3-熟悉, 4-掌握, 5-精通';
COMMENT ON COLUMN knowledge_cards.source_type IS '来源类型：manual-手动创建, course-课程提取, note-笔记转换';