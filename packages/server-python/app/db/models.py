"""
SQLAlchemy ORM 模型定义
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, UniqueConstraint, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(100))
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="delete")
    stages = relationship("Stage", back_populates="user", cascade="delete")
    media_files = relationship("MediaFile", back_populates="user", cascade="delete")


class OAuthAccount(Base):
    """OAuth 关联表"""
    __tablename__ = "oauth_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # 'apple', 'google', 'wechat'
    provider_user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    user = relationship("User", back_populates="oauth_accounts")

    # 唯一约束
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id"),
    )


class Stage(Base):
    """课程表"""
    __tablename__ = "stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    language_directive = Column(Text)
    style = Column(Text)
    agent_ids = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    user = relationship("User", back_populates="stages")
    scenes = relationship("Scene", back_populates="stage", cascade="delete")


class Scene(Base):
    """场景表"""
    __tablename__ = "scenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # 'slide', 'quiz', 'interactive', 'pbl'
    title = Column(String(255))
    order_index = Column(Integer)
    content = Column(JSONB)
    actions = Column(JSONB)
    whiteboards = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    stage = relationship("Stage", back_populates="scenes")


class MediaFile(Base):
    """媒体文件表"""
    __tablename__ = "media_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"))
    type = Column(String(50))  # 'image', 'video', 'audio'
    oss_key = Column(Text)
    oss_bucket = Column(String(100))
    mime_type = Column(String(100))
    size = Column(Integer)
    prompt = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    user = relationship("User", back_populates="media_files")


class GenerationJob(Base):
    """生成作业表"""
    __tablename__ = "generation_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50))  # 'queued', 'running', 'succeeded', 'failed'
    step = Column(String(50))
    progress = Column(Integer)
    message = Column(Text)
    input_summary = Column(JSONB)
    result = Column(JSONB)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TokenAccount(Base):
    """Token账户表"""
    __tablename__ = "token_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    balance = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class PointAccount(Base):
    """积分账户表"""
    __tablename__ = "point_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    balance = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class TokenTransaction(Base):
    """Token交易流水表"""
    __tablename__ = "token_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # purchase, exchange, spend, reward
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    description = Column(Text)
    reference_id = Column(UUID(as_uuid=True))  # 关联订单或操作
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PointTransaction(Base):
    """积分交易流水表"""
    __tablename__ = "point_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(50), nullable=False)  # course, daily, qanda, notes, invitation, exchange
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    reference_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Order(Base):
    """支付订单表"""
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # 金额（分）
    token_amount = Column(Integer, nullable=False)  # Token数量
    payment_method = Column(String(20), nullable=False)  # wechat, alipay
    status = Column(String(20), default='created')  # created, paid, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class Question(Base):
    """问题表"""
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    bounty = Column(Integer, default=0)  # 悬赏积分
    bounty_status = Column(String(20), default='open')  # open, claimed, closed
    tags = Column(Text)
    view_count = Column(Integer, default=0)
    answer_count = Column(Integer, default=0)
    accepted_answer_id = Column(UUID(as_uuid=True), ForeignKey("answers.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    answers = relationship("Answer", back_populates="question", cascade="delete")


class Answer(Base):
    """回答表"""
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    rating = Column(Integer, default=0)
    vote_count = Column(Integer, default=0)
    is_accepted = Column(Boolean, default=False)
    accepted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    question = relationship("Question", back_populates="answers")
    user = relationship("User")


class AnswerVote(Base):
    """回答投票表"""
    __tablename__ = "answer_votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    answer_id = Column(UUID(as_uuid=True), ForeignKey("answers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote = Column(Integer, nullable=False)  # 1=赞成, -1=反对
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("answer_id", "user_id"),
    )


class UserInvitationCode(Base):
    """用户邀请码表"""
    __tablename__ = "user_invitation_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    invite_code = Column(String(16), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class UserInvitation(Base):
    """邀请记录表"""
    __tablename__ = "user_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invitee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    level = Column(Integer, default=1)  # 1=直接, 2=二级, 3=三级
    reward_points = Column(Integer, default=0)
    reward_tokens = Column(Integer, default=0)
    rewarded_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class PaymentCallback(Base):
    """支付回调记录表"""
    __tablename__ = "payment_callbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False)  # wechat, alipay
    transaction_id = Column(String(64), index=True)
    amount = Column(Integer)
    status = Column(String(20))
    raw_data = Column(Text)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    """会员订阅表"""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    plan_type = Column(String(20), nullable=False)  # 'free', 'premium', 'enterprise'
    status = Column(String(20), nullable=False)  # 'active', 'trial', 'expired', 'cancelled'
    started_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    auto_renew = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class SubscriptionUsage(Base):
    """会员权益使用记录表"""
    __tablename__ = "subscription_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature = Column(String(50), nullable=False)
    usage_count = Column(Integer, default=0)
    reset_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class BuddyConfig(Base):
    """学习搭子配置表"""
    __tablename__ = "buddy_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    buddy_type = Column(String(20), nullable=False)
    buddy_name = Column(String(50))
    buddy_avatar = Column(String(100))
    tone_style = Column(String(20))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class BuddyMessage(Base):
    """学习搭子消息记录表"""
    __tablename__ = "buddy_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_event = Column(String(30), nullable=False)
    message_type = Column(String(20))
    content = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class SharedNote(Base):
    """共享笔记表"""
    __tablename__ = "shared_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"))
    visibility = Column(String(20), default='public')
    price = Column(Integer, default=0)
    tags = Column(Text)
    rating = Column(Integer, default=0)
    rating_count = Column(Integer, default=0)
    purchase_count = Column(Integer, default=0)
    status = Column(String(20), default='published')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    purchases = relationship("NotePurchase", back_populates="note", cascade="delete")


class NotePurchase(Base):
    """笔记购买记录表"""
    __tablename__ = "note_purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(UUID(as_uuid=True), ForeignKey("shared_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    price = Column(Integer, nullable=False)
    author_reward = Column(Integer, nullable=False)
    platform_fee = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    note = relationship("SharedNote", back_populates="purchases")

    __table_args__ = (
        UniqueConstraint("user_id", "note_id"),
    )


class MatchingPreference(Base):
    """用户匹配偏好表"""
    __tablename__ = "matching_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    goal_tags = Column(Text)
    course_ids = Column(Text)
    progress_level = Column(String(20))
    schedule_preference = Column(String(20))
    match_mode = Column(String(20), default='auto')
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class LearningMatch(Base):
    """学习匹配记录表"""
    __tablename__ = "learning_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id_1 = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id_2 = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    match_type = Column(String(20), default='study')
    match_score = Column(Integer, default=0)
    common_courses = Column(Text)
    common_tags = Column(Text)
    status = Column(String(20), default='pending')
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id_1", "user_id_2"),
    )


class DailyTaskProgress(Base):
    """每日任务进度表"""
    __tablename__ = "daily_task_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(50), nullable=False)
    task_date = Column(DateTime, nullable=False)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "task_id", "task_date"),
    )


class CourseRecommendation(Base):
    """课程推荐关系表"""
    __tablename__ = "course_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    target_course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_type = Column(String(20), nullable=False)
    weight = Column(Float, default=1.0)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class CourseCompletion(Base):
    """课程完成记录表"""
    __tablename__ = "course_completions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at = Column(DateTime, nullable=False)
    completion_status = Column(String(20), default='completed')
    rating = Column(Integer)
    notes = Column(Text)
    scenes_completed = Column(Integer, default=0)
    total_scenes = Column(Integer, default=0)
    time_spent_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "course_id"),
    )


class LearningPath(Base):
    """学习路径表"""
    __tablename__ = "learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    path_name = Column(String(255), nullable=False)
    description = Column(Text)
    course_ids = Column(Text)
    status = Column(String(20), default='active')
    progress = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class ReviewSchedule(Base):
    """复习计划表"""
    __tablename__ = "review_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_id = Column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="CASCADE"))
    review_type = Column(String(20), nullable=False)
    trigger_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=5)
    status = Column(String(20), default='pending')
    priority = Column(Integer, default=1)
    content_preview = Column(Text)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class ReviewRecord(Base):
    """复习记录表"""
    __tablename__ = "review_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("review_schedules.id", ondelete="CASCADE"))
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False)
    review_type = Column(String(20), nullable=False)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    time_spent_minutes = Column(Integer, default=0)
    effectiveness_rating = Column(Integer)
    quiz_score = Column(Integer)
    notes = Column(Text)
    next_review_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class LearningPassport(Base):
    """学习护照表"""
    __tablename__ = "learning_passports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_name = Column(String(100), nullable=False)
    skill_category = Column(String(50))
    skill_level = Column(Integer, default=1)
    courses_completed = Column(Integer, default=0)
    projects_completed = Column(Integer, default=0)
    total_time_hours = Column(Float, default=0)
    quiz_avg_score = Column(Float)
    review_completion_rate = Column(Float)
    verified = Column(Boolean, default=False)
    verification_hash = Column(String(64))
    badges = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "skill_name"),
    )


class ProjectPortfolio(Base):
    """项目作品表"""
    __tablename__ = "project_portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"))
    project_name = Column(String(255), nullable=False)
    project_type = Column(String(50))
    description = Column(Text)
    content_url = Column(Text)
    thumbnail_url = Column(Text)
    tags = Column(Text)
    rating = Column(Integer)
    ai_feedback = Column(Text)
    is_public = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class SkillAssessment(Base):
    """技能评估表"""
    __tablename__ = "skill_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_name = Column(String(100), nullable=False)
    assessment_type = Column(String(20))
    score = Column(Float, nullable=False)
    level_before = Column(Integer)
    level_after = Column(Integer)
    passed = Column(Boolean, default=False)
    details = Column(Text)
    assessed_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class AdminLog(Base):
    """管理员操作日志表"""
    __tablename__ = "admin_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    target = Column(String(255), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class LLMConfig(Base):
    """LLM配置表"""
    __tablename__ = "llm_configs"

    provider = Column(String(50), primary_key=True)
    model = Column(String(100), nullable=False)
    api_key = Column(String(255))
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=2000)
    top_p = Column(Float, default=0.9)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PricingConfig(Base):
    """价格配置表"""
    __tablename__ = "pricing_configs"

    type = Column(String(20), primary_key=True)  # 'token_pack' or 'subscription'
    name = Column(String(50), primary_key=True)
    price = Column(Float, nullable=False)
    tokens = Column(Integer, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("type", "name"),
    )


class RewardRule(Base):
    """积分奖励规则表"""
    __tablename__ = "reward_rules"

    action = Column(String(50), primary_key=True)
    points = Column(Integer, nullable=False)
    description = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewRewardConfig(Base):
    """复习奖励配置表"""
    __tablename__ = "review_reward_configs"

    review_type = Column(String(50), primary_key=True)
    points = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemSetting(Base):
    """系统设置表"""
    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Admin(Base):
    """管理员账户表"""
    __tablename__ = "admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(100))
    is_super_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    last_login_ip = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminRole(Base):
    """管理员角色表"""
    __tablename__ = "admin_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminRoleAssignment(Base):
    """管理员角色分配表"""
    __tablename__ = "admin_role_assignments"

    admin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("admins.id"))


class AdminPermission(Base):
    """管理员权限表"""
    __tablename__ = "admin_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


class RolePermission(Base):
    """角色权限关联表"""
    __tablename__ = "role_permissions"

    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("admin_permissions.id", ondelete="CASCADE"), primary_key=True)


class AdminSession(Base):
    """管理员会话表"""
    __tablename__ = "admin_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class LoginLog(Base):
    """登录日志表"""
    __tablename__ = "login_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL"))
    email = Column(String(255), nullable=False)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class VideoSource(Base):
    """视频转课程源表"""
    __tablename__ = "video_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_url = Column(Text, nullable=False)
    platform = Column(String(20), nullable=False)  # 'youtube', 'bilibili', 'other'
    video_id = Column(String(100))
    title = Column(String(500))
    duration_seconds = Column(Integer)
    thumbnail_url = Column(Text)
    language = Column(String(10), default="zh-CN")
    subtitles_available = Column(Boolean, default=False)
    subtitles_text = Column(Text)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CourseVideoMapping(Base):
    """课程-视频映射表"""
    __tablename__ = "course_video_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    video_source_id = Column(UUID(as_uuid=True), ForeignKey("video_sources.id", ondelete="CASCADE"), nullable=False)
    topic_index = Column(Integer)
    scene_id = Column(UUID(as_uuid=True), ForeignKey("scenes.id", ondelete="SET NULL"))
    timestamp_start = Column(Integer)
    timestamp_end = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class ShareCard(Base):
    """分享卡片表"""
    __tablename__ = "share_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_type = Column(String(20), nullable=False)  # 'achievement', 'course_completion', 'passport', 'checkin'
    reference_id = Column(String(100))
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300))
    image_url = Column(Text)
    share_url = Column(Text)
    qr_code_url = Column(Text)
    style = Column(String(20), default="gradient")
    platform = Column(String(20), default="wechat")
    view_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ShareEvent(Base):
    """分享事件追踪表"""
    __tablename__ = "share_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("share_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(20), nullable=False)
    action = Column(String(20), default="share")
    referrer = Column(Text)
    shared_at = Column(DateTime, default=datetime.utcnow, index=True)


class PersonaSession(Base):
    """智能体对话会话表"""
    __tablename__ = "persona_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    persona_id = Column(String(50), nullable=False, index=True)  # 'confucius', 'socrates', 'da_vinci'
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime)
    message_count = Column(Integer, default=0)
    topic = Column(Text)
    rating = Column(Integer)
    feedback = Column(Text)
    mode = Column(String(20), default="teaching")


class PersonaMessage(Base):
    """智能体对话消息表"""
    __tablename__ = "persona_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("persona_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_message = Column(Text, nullable=False)
    persona_response = Column(Text, nullable=False)
    style_used = Column(String(50))
    quotes_used = Column(Text)  # JSON array
    created_at = Column(DateTime, default=datetime.utcnow)


class PersonaStat(Base):
    """智能体统计数据表"""
    __tablename__ = "persona_stats"

    persona_id = Column(String(50), primary_key=True)
    total_sessions = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    avg_rating = Column(Float, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)


class DepthProgress(Base):
    """学习深度进度追踪表"""
    __tablename__ = "depth_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    depth = Column(String(20), nullable=False, index=True)  # 'skim', 'understand', 'master'
    scenes_completed = Column(Integer, default=0)
    total_scenes = Column(Integer)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)


class ProgrammingExercise(Base):
    """编程练习题表"""
    __tablename__ = "programming_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(String(20), default="medium")
    language = Column(String(20), nullable=False, index=True)
    starter_code = Column(Text)
    test_cases = Column(Text)
    hints = Column(Text)
    max_score = Column(Integer, default=100)
    time_limit = Column(Integer, default=10)
    memory_limit = Column(Integer, default=256)
    created_at = Column(DateTime, default=datetime.utcnow)


class CodeSubmission(Base):
    """代码提交记录表"""
    __tablename__ = "code_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("programming_exercises.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(Text, nullable=False)
    language = Column(String(20), nullable=False, index=True)
    passed = Column(Boolean, default=False)
    score = Column(Integer, default=0)
    execution_time = Column(Float)
    memory_used = Column(Float)
    errors = Column(Text)
    submitted_at = Column(DateTime, default=datetime.utcnow)


class NoteReminder(Base):
    """笔记提醒表"""
    __tablename__ = "note_reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    template_type = Column(String(50), nullable=False)
    template_sections = Column(Text, nullable=False)
    reward_points = Column(Integer, nullable=False)
    deadline = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending", index=True)
    note_id = Column(UUID(as_uuid=True), ForeignKey("notes.id", ondelete="SET NULL"))
    completed_at = Column(DateTime)
    skipped_at = Column(DateTime)
    skip_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)