-- OpenMAIC 完整数据库初始化脚本
-- 生成时间: 2025-05-30
-- 用途: 新环境部署时初始化数据库结构

-- ============================================
-- 1. 用户与认证 (initial_schema)
-- ============================================

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
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON oauth_accounts(user_id);

-- ============================================
-- 2. 课程与场景 (initial_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT,
    language_directive VARCHAR(10),
    agent_ids TEXT[],
    generated_agent_configs JSONB,
    pending_outlines JSONB,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_user_id ON stages(user_id);

CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    key_points TEXT[],
    order_index INTEGER,
    content JSONB,
    citation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenes_stage ON scenes(stage_id);

-- ============================================
-- 3. 积分系统 (token_points_schema)
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

CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_token_transactions_user ON token_transactions(user_id);

-- ============================================
-- 4. 测评系统 (assessments_schema)
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
CREATE INDEX IF NOT EXISTS ix_learning_assessments_status ON learning_assessments(status);

-- ============================================
-- 5. 企业功能 (enterprise_schema)
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
CREATE INDEX IF NOT EXISTS ix_enterprises_status ON enterprises(status);

CREATE TABLE IF NOT EXISTS enterprise_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT now(),
    UNIQUE(enterprise_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_enterprise_members_enterprise ON enterprise_members(enterprise_id);
CREATE INDEX IF NOT EXISTS ix_enterprise_members_user ON enterprise_members(user_id);

CREATE TABLE IF NOT EXISTS enterprise_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    token VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 6. 笔记系统 (notes_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS shared_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_shared_notes_user ON shared_notes(user_id);
CREATE INDEX IF NOT EXISTS ix_shared_notes_course ON shared_notes(course_id);

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
CREATE INDEX IF NOT EXISTS ix_note_citations_course ON note_citations(course_id);

CREATE TABLE IF NOT EXISTS note_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    note_id UUID REFERENCES shared_notes(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_note_reminders_user ON note_reminders(user_id);
CREATE INDEX IF NOT EXISTS ix_note_reminders_course ON note_reminders(course_id);

-- ============================================
-- 7. 游戏化系统 (gamification_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON daily_checkins(checkin_date);

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    achieved_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON user_achievements(user_id);

CREATE TABLE IF NOT EXISTS shared_classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    share_code VARCHAR(20) UNIQUE NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_user_id ON shared_classrooms(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_code ON shared_classrooms(share_code);

CREATE TABLE IF NOT EXISTS daily_task_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(50) NOT NULL,
    task_date DATE NOT NULL,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, task_id, task_date)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_user_id ON daily_task_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_task_id ON daily_task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_date ON daily_task_progress(task_date);

-- ============================================
-- 8. 课程完成与推荐 (recommendations_schema)
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
-- 9. 教室会话 (classroom_sessions_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS classroom_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(50) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    participant_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON classroom_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_owner_id ON classroom_sessions(owner_id);

CREATE TABLE IF NOT EXISTS classroom_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message_type VARCHAR(20) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON classroom_messages(session_id);

CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'student',
    joined_at TIMESTAMP DEFAULT now(),
    left_at TIMESTAMP,
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON session_participants(session_id);

CREATE TABLE IF NOT EXISTS whiteboard_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_session_id ON whiteboard_states(session_id);

-- ============================================
-- 10. 管理员系统 (admin_auth_schema, admin_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_admins_email ON admins(email);

CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(admin_id, role_name)
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_admin_logs_created_at ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_admin_logs_action ON admin_logs(action);

-- ============================================
-- 11. 订阅与支付 (subscriptions_schema, payment_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL,
    product_id VARCHAR(100),
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(64),
    paid_at TIMESTAMP,
    notify_data TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 12. 邀请系统 (invitation_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS user_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_invitation_codes_user_id ON user_invitation_codes(user_id);
CREATE INDEX IF NOT EXISTS ix_user_invitation_codes_invite_code ON user_invitation_codes(invite_code);

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(20) NOT NULL,
    reward_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_invitations_inviter_id ON user_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS ix_user_invitations_invitee_id ON user_invitations(invitee_id);

-- ============================================
-- 13. 深度学习追踪 (depth_levels_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS depth_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL,
    progress FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, course_id, depth)
);

CREATE INDEX IF NOT EXISTS ix_depth_progress_user ON depth_progress(user_id);
CREATE INDEX IF NOT EXISTS ix_depth_progress_course ON depth_progress(course_id);
CREATE INDEX IF NOT EXISTS ix_depth_progress_depth ON depth_progress(depth);

-- ============================================
-- 14. 匹配系统 (matching_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS matching_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_subjects TEXT[],
    preferred_times JSONB,
    learning_style VARCHAR(50),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matching_prefs_user ON matching_preferences(user_id);

CREATE TABLE IF NOT EXISTS learning_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_score FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_matches_user1 ON learning_matches(user_id_1);
CREATE INDEX IF NOT EXISTS idx_learning_matches_user2 ON learning_matches(user_id_2);
CREATE INDEX IF NOT EXISTS idx_learning_matches_status ON learning_matches(status);

-- ============================================
-- 15. 助手系统 (buddy_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS buddy_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    personality VARCHAR(50) DEFAULT 'friendly',
    tone VARCHAR(50) DEFAULT 'encouraging',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buddy_configs_user ON buddy_configs(user_id);

CREATE TABLE IF NOT EXISTS buddy_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buddy_messages_user ON buddy_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_buddy_messages_created ON buddy_messages(created_at);

-- ============================================
-- 16. 编程学习 (programming_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS programming_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    initial_code TEXT,
    test_cases JSONB,
    difficulty VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programming_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES programming_exercises(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    passed BOOLEAN DEFAULT false,
    score INTEGER,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 17. 问答系统 (questions_answers_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    bounty INTEGER DEFAULT 0,
    bounty_status VARCHAR(20) DEFAULT 'open',
    tags TEXT,
    view_count INTEGER DEFAULT 0,
    answer_count INTEGER DEFAULT 0,
    accepted_answer_id UUID,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    is_accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answer_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(answer_id, user_id)
);

-- 为问答系统添加索引
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_bounty ON questions(bounty DESC);
CREATE INDEX IF NOT EXISTS idx_questions_bounty_status ON questions(bounty_status);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_vote_count ON answers(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_answers_is_accepted ON answers(is_accepted);
CREATE INDEX IF NOT EXISTS idx_answer_votes_answer_id ON answer_votes(answer_id);
CREATE INDEX IF NOT EXISTS idx_answer_votes_user_id ON answer_votes(user_id);

-- ============================================
-- 18. Personas (personas_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt TEXT,
    voice_config JSONB,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 19. 视频课程 (video_course_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS video_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 20. 护照/分享卡片 (passport_schema, share_cards_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS learning_passports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_courses INTEGER DEFAULT 0,
    total_scenes INTEGER DEFAULT 0,
    total_hours FLOAT DEFAULT 0,
    achievements JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 21. 评价系统 (review_schema)
-- ============================================

CREATE TABLE IF NOT EXISTS course_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, course_id)
);

-- ============================================
-- 完成提示
-- ============================================

-- 执行完成后检查:
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 初始化管理员账户 (可选):
-- INSERT INTO admins (email, password_hash, nickname, is_super_admin)
-- VALUES ('admin@example.com', '$2b$12$...', '超级管理员', true);
