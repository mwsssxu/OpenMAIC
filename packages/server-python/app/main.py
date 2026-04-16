"""
OpenMAIC Python Backend - FastAPI 入口
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import init_db, close_db
from app.routes import auth, classrooms, generate, chat, media


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
    description="多用户交互课堂 API",
    version="0.1.0",
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


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "version": "0.1.0"}