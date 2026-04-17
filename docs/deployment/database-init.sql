-- OpenMAIC 数据库初始化SQL
-- 用于手动执行迁移或生产部署

-- 执行顺序: 按文件名顺序执行 alembic/versions/*.py 生成的SQL

-- ============================================
-- 1. 基础表 (initial_schema)
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    avatar_url TEXT,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    subscription_ends_at TIMESTAMP,
    token_balance INTEGER DEFAULT 0,
    point_balance INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- 课程表
CREATE TABLE IF NOT EXISTS stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stages_user ON stages(user_id);

-- 场景表
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    order_index INTEGER,
    content JSONB,
    citation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_scenes_stage ON scenes(stage_id);

-- ============================================
-- 2. Token积分系统 (token_points_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS point_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_id UUID,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_point_transactions_user ON point_transactions(user_id);

-- ============================================
-- 3. 测评系统 (assessments_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS learning_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) NOT NULL,
    questions TEXT NOT NULL,
    answers TEXT,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    score FLOAT,
    mastery_level VARCHAR(20),
    passed BOOLEAN DEFAULT false,
    correct_count INTEGER,
    time_spent_minutes INTEGER,
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_learning_assessments_user ON learning_assessments(user_id);
CREATE INDEX IF NOT EXISTS ix_learning_assessments_course ON learning_assessments(course_id);

-- ============================================
-- 4. 企业功能 (enterprise_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS enterprises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    industry VARCHAR(100),
    size VARCHAR(20),
    contact_email VARCHAR(255) NOT NULL,
    plan_type VARCHAR(20) DEFAULT 'basic',
    member_count INTEGER DEFAULT 1,
    member_limit INTEGER DEFAULT 10,
    course_count INTEGER DEFAULT 0,
    course_limit INTEGER DEFAULT 50,
    storage_used INTEGER DEFAULT 0,
    storage_limit INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_enterprises_owner ON enterprises(owner_id);

CREATE TABLE IF NOT EXISTS enterprise_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT now(),
    UNIQUE(enterprise_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_enterprise_members_enterprise ON enterprise_members(enterprise_id);

-- ============================================
-- 5. 笔记引用 (note_citations_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS note_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    content_snippet TEXT NOT NULL,
    citation_type VARCHAR(20) DEFAULT 'direct',
    position_start INTEGER,
    position_end INTEGER,
    context TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(note_id, scene_id)
);

CREATE INDEX IF NOT EXISTS ix_note_citations_note ON note_citations(note_id);
CREATE INDEX IF NOT EXISTS ix_note_citations_scene ON note_citations(scene_id);

-- ============================================
-- 6. 课程完成与推荐 (recommendations_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS course_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    completed_at TIMESTAMP NOT NULL,
    completion_status VARCHAR(20) DEFAULT 'completed',
    rating INTEGER,
    mastery_level VARCHAR(20),
    scenes_completed INTEGER DEFAULT 0,
    total_scenes INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS ix_course_completions_user ON course_completions(user_id);

CREATE TABLE IF NOT EXISTS course_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    target_course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(20) NOT NULL,
    weight FLOAT DEFAULT 1.0,
    reason TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 完成提示
-- ============================================

-- 执行完成后检查:
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- 应返回 62 (或接近)

-- 初始化管理员账户 (可选):
-- INSERT INTO admins (email, password_hash, nickname, is_super_admin)
-- VALUES ('admin@example.com', '$2b$12$...', '超级管理员', true);