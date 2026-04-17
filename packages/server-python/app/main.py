"""
OpenMAIC Python Backend - FastAPI 入口
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import init_db, close_db
from app.routes import auth, classrooms, generate, chat, media, policies, achievements, checkin, sharing, classroom_sessions, tokens, points


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库连接
    await init_db()
    yield
    # 关闭时清理资源
    await close_db()


app = FastAPI(
    title="OpenMAIC API",
    description="多用户交互课堂 API - 支持成就系统、打卡激励、课程分享、多人实时讨论",
    version="0.3.0",
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


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "version": "0.3.0"}