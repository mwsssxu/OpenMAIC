"""
OpenMAIC Python Backend - FastAPI 入口
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.db.database import init_db, close_db
from app.routes import auth, classrooms, generate, chat, media, policies, achievements, checkin, sharing, classroom_sessions, tokens, points, questions, answers, invitations, payment, subscriptions, buddy, notes, matching, gamification, recommendations, review, passport, admin, admin_auth, video_course, question_course, share_cards, personas, depth_levels, programming, note_reminders, assessments, note_citations, enterprise

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # SECURITY CHECK: Verify SECRET_KEY is configured
    if not settings.SECRET_KEY:
        if settings.TESTING_MODE:
            # Allow empty key in testing mode (use default)
            settings.SECRET_KEY = "test-secret-key-for-development-only"
            logger.warning("Using default SECRET_KEY for testing mode - NOT SAFE FOR PRODUCTION!")
        else:
            raise RuntimeError(
                "SECRET_KEY must be set in environment variables for production! "
                "Set SECRET_KEY in .env file or environment."
            )

    # 启动时初始化数据库和 Redis 连接
    await init_db()
    await init_redis()
    logger.info(f"OpenMAIC Backend v0.23.0 started - TESTING_MODE: {settings.TESTING_MODE}")
    yield
    # 关闭时清理资源
    await close_redis()
    await close_db()


app = FastAPI(
    title="OpenMAIC API",
    description="多用户交互课堂 API - 支持成就系统、打卡激励、课程分享、多人实时讨论、问答悬赏、邀请奖励、支付系统、会员订阅、学习搭子、共享笔记、学习匹配、游戏化增强、课程推荐、间隔复习、学习护照、管理后台、视频转课程、学习效果测评、笔记引用、企业功能",
    version="0.23.0",
    lifespan=lifespan,
)

# CORS 配置（支持 Web 和移动端）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/auth", tags=["认证"])
app.include_router(classrooms.router, prefix="/classrooms", tags=["课程"])
app.include_router(generate.router, prefix="/generate", tags=["生成"])
app.include_router(chat.router, prefix="/chat", tags=["聊天"])
app.include_router(media.router, prefix="/media", tags=["媒体"])
app.include_router(policies.router, prefix="/policies", tags=["政策"])
app.include_router(achievements.router, prefix="/achievements", tags=["成就"])
app.include_router(checkin.router, prefix="/checkin", tags=["打卡"])
app.include_router(sharing.router, prefix="/sharing", tags=["分享"])
app.include_router(classroom_sessions.router, prefix="/sessions", tags=["多人课堂"])
app.include_router(tokens.router, prefix="/tokens", tags=["Token"])
app.include_router(points.router, prefix="/points", tags=["积分"])
app.include_router(questions.router, prefix="/questions", tags=["问答"])
app.include_router(answers.router, prefix="/answers", tags=["回答"])
app.include_router(invitations.router, prefix="/invitations", tags=["邀请"])
app.include_router(payment.router, prefix="/payment", tags=["支付"])
app.include_router(subscriptions.router, prefix="/subscriptions", tags=["订阅"])
app.include_router(buddy.router, prefix="/buddy", tags=["学习搭子"])
app.include_router(notes.router, prefix="/notes", tags=["共享笔记"])
app.include_router(matching.router, prefix="/matching", tags=["学习匹配"])
app.include_router(gamification.router, prefix="/gamification", tags=["游戏化"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["课程推荐"])
app.include_router(review.router, prefix="/review", tags=["间隔复习"])
app.include_router(passport.router, prefix="/passport", tags=["学习护照"])
app.include_router(admin.router, tags=["管理后台"])
app.include_router(admin_auth.router, tags=["管理员认证"])
app.include_router(video_course.router, tags=["视频转课程"])
app.include_router(question_course.router, tags=["问题驱动课程"])
app.include_router(share_cards.router, tags=["社交分享卡片"])
app.include_router(personas.router, tags=["AI智能体"])
app.include_router(depth_levels.router, tags=["学习深度分层"])
app.include_router(programming.router, tags=["编程学习模板"])
app.include_router(note_reminders.router, tags=["笔记提醒系统"])
app.include_router(assessments.router, prefix="/assessments", tags=["学习效果测评"])
app.include_router(note_citations.router, tags=["笔记引用"])
app.include_router(enterprise.router, tags=["企业功能"])


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "version": "0.23.0"}