-- 问答悬赏系统表结构
-- 执行时间: 2026-05-28

-- ==================== 问题表 ====================

-- 检查并创建 questions 表
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'questions') THEN
        CREATE TABLE questions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            bounty INTEGER DEFAULT 0,
            bounty_status VARCHAR(20) DEFAULT 'open',
            tags TEXT,
            view_count INTEGER DEFAULT 0,
            answer_count INTEGER DEFAULT 0,
            accepted_answer_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        );

        -- 索引
        CREATE INDEX idx_questions_user_id ON questions(user_id);
        CREATE INDEX idx_questions_created_at ON questions(created_at DESC);
        CREATE INDEX idx_questions_bounty ON questions(bounty DESC);
        CREATE INDEX idx_questions_bounty_status ON questions(bounty_status);

        RAISE NOTICE 'Created questions table';
    ELSE
        RAISE NOTICE 'questions table already exists';
    END IF;
END $$;

-- ==================== 回答表 ====================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'answers') THEN
        CREATE TABLE answers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            rating DECIMAL(3,2) DEFAULT 0,
            vote_count INTEGER DEFAULT 0,
            is_accepted BOOLEAN DEFAULT FALSE,
            accepted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        );

        -- 索引
        CREATE INDEX idx_answers_question_id ON answers(question_id);
        CREATE INDEX idx_answers_user_id ON answers(user_id);
        CREATE INDEX idx_answers_vote_count ON answers(vote_count DESC);
        CREATE INDEX idx_answers_is_accepted ON answers(is_accepted);

        RAISE NOTICE 'Created answers table';
    ELSE
        RAISE NOTICE 'answers table already exists';
    END IF;
END $$;

-- ==================== 回答投票表 ====================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'answer_votes') THEN
        CREATE TABLE answer_votes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(answer_id, user_id)
        );

        -- 索引
        CREATE INDEX idx_answer_votes_answer_id ON answer_votes(answer_id);
        CREATE INDEX idx_answer_votes_user_id ON answer_votes(user_id);

        RAISE NOTICE 'Created answer_votes table';
    ELSE
        RAISE NOTICE 'answer_votes table already exists';
    END IF;
END $$;

-- ==================== 添加外键约束 ====================

-- 为 questions 表添加 accepted_answer_id 外键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_questions_accepted_answer'
        AND table_name = 'questions'
    ) THEN
        ALTER TABLE questions
        ADD CONSTRAINT fk_questions_accepted_answer
        FOREIGN KEY (accepted_answer_id) REFERENCES answers(id) ON DELETE SET NULL;

        RAISE NOTICE 'Added fk_questions_accepted_answer constraint';
    ELSE
        RAISE NOTICE 'fk_questions_accepted_answer already exists';
    END IF;
END $$;

-- ==================== 添加触发器自动更新 updated_at ====================

-- 创建或替换更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 questions 表添加触发器
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_questions_updated_at'
    ) THEN
        CREATE TRIGGER update_questions_updated_at
        BEFORE UPDATE ON questions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

        RAISE NOTICE 'Added update_questions_updated_at trigger';
    ELSE
        RAISE NOTICE 'update_questions_updated_at trigger already exists';
    END IF;
END $$;

-- 为 answers 表添加触发器
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_answers_updated_at'
    ) THEN
        CREATE TRIGGER update_answers_updated_at
        BEFORE UPDATE ON answers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

        RAISE NOTICE 'Added update_answers_updated_at trigger';
    ELSE
        RAISE NOTICE 'update_answers_updated_at trigger already exists';
    END IF;
END $$;

-- ==================== 授权 ====================

GRANT SELECT, INSERT, UPDATE, DELETE ON questions TO maic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON answers TO maic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON answer_votes TO maic_user;
