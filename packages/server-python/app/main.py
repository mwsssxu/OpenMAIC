"""
OpenMAIC Python Backend - FastAPI 入口
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

# 先导入 settings，再配置日志级别
from app.core.config import settings

# 配置日志级别（DEBUG模式输出详细日志）
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)
from app.core.redis import init_redis, close_redis
from app.db.database import init_db, close_db
from app.routes import auth, classrooms, generate, chat, media, policies, achievements, checkin, sharing, classroom_sessions, tokens, points, questions, answers, invitations, payment, subscriptions, buddy, notes, matching, gamification, recommendations, review, passport, admin_full, admin_auth, video_course, question_course, share_cards, personas, depth_levels, programming, note_reminders, assessments, note_citations, enterprise, tts, knowledge, personal_notes, profile, maic_ui_proxy, learning, mistakes
from app.routes.quiz import router as quiz_router
from app.services.tts_service import close_tts_session as close_tts

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # SECURITY CHECK: Verify SECRET_KEY is configured
    if not settings.SECRET_KEY or settings.SECRET_KEY == "your-secret-key-change-in-production":
        if settings.TESTING_MODE:
            # Allow weak key in testing mode (use secure random)
            import secrets
            settings.SECRET_KEY = secrets.token_urlsafe(32)
            logger.warning("Using random SECRET_KEY for testing mode - NOT SAFE FOR PRODUCTION!")
        else:
            raise RuntimeError(
                "SECRET_KEY must be set to a secure random value in environment variables! "
                "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )

    # 启动警告检查
    if not settings.TESTING_MODE:
        logger.warning("Production mode enabled - ensure payment callback signatures are verified!")

    # 启动时初始化数据库和 Redis 连接
    await init_db()
    await init_redis()
    logger.info(f"OpenMAIC Backend v0.23.0 started - TESTING_MODE: {settings.TESTING_MODE}")
    yield
    # 关闭时清理资源
    await close_redis()
    await close_db()
    await close_tts()


app = FastAPI(
    title="OpenMAIC API",
    description="多用户交互课堂 API - 支持成就系统、打卡激励、课程分享、多人实时讨论、问答悬赏、邀请奖励、支付系统、会员订阅、学习搭子、共享笔记、学习匹配、游戏化增强、课程推荐、间隔复习、学习护照、管理后台、视频转课程、学习效果测评、笔记引用、企业功能",
    version="0.23.0",
    lifespan=lifespan,
)


# ── 全局 422 校验错误 → 多语言友好提示 ──

FIELD_NAMES_ZH = {
    "email": "邮箱", "password": "密码", "nickname": "昵称",
    "name": "名称", "title": "标题", "content": "内容",
    "description": "描述", "phone": "手机号", "code": "验证码",
    "avatar_url": "头像", "language_directive": "语言",
    "topic": "主题", "question": "问题", "answer": "答案",
    "type": "类型", "stage_id": "课程ID", "course_id": "课程ID",
}

FIELD_NAMES_EN = {
    "email": "email", "password": "password", "nickname": "nickname",
    "name": "name", "title": "title", "content": "content",
    "description": "description", "phone": "phone", "code": "code",
    "avatar_url": "avatar", "language_directive": "language",
    "topic": "topic", "question": "question", "answer": "answer",
    "type": "type", "stage_id": "course ID", "course_id": "course ID",
}

ERROR_MESSAGES_ZH = {
    "missing": "请输入{field}",
    "string_too_short": "{field}太短",
    "string_too_long": "{field}太长",
    "value_error": "{field}格式不正确",
    "type_error": "{field}格式不正确",
    "json_invalid": "请求数据格式错误",
    "bool_parsing": "{field}应为是/否",
    "int_parsing": "{field}应为数字",
    "greater_than": "{field}数值太小",
}

ERROR_MESSAGES_EN = {
    "missing": "Please enter {field}",
    "string_too_short": "{field} is too short",
    "string_too_long": "{field} is too long",
    "value_error": "Invalid {field}",
    "type_error": "Invalid {field}",
    "json_invalid": "Invalid request data format",
    "bool_parsing": "{field} must be true or false",
    "int_parsing": "{field} must be a number",
    "greater_than": "{field} is too small",
}


def _get_locale(request: Request) -> str:
    """从请求头获取语言偏好，默认 zh-CN"""
    accept = request.headers.get("accept-language", "")
    if "en" in accept.lower():
        return "en-US"
    return "zh-CN"


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """将 Pydantic 校验错误转为多语言友好提示"""
    locale = _get_locale(request)
    is_en = locale == "en-US"

    field_names = FIELD_NAMES_EN if is_en else FIELD_NAMES_ZH
    error_messages = ERROR_MESSAGES_EN if is_en else ERROR_MESSAGES_ZH
    separator = "; " if is_en else "；"

    errors = exc.errors()
    messages = []
    for err in errors:
        err_type = err.get("type", "")
        loc = err.get("loc", [])
        # 提取字段名（取 loc 中最后一个非 'body' 的部分）
        field = ""
        for part in reversed(loc):
            if part != "body" and isinstance(part, str):
                field = part
                break
        field_cn = field_names.get(field, field or ("input" if is_en else "输入"))

        # 匹配错误类型
        msg = error_messages.get(err_type)
        if msg:
            messages.append(msg.format(field=field_cn))
        elif "email" in err_type or "email" in str(err.get("msg", "")).lower():
            msg = error_messages.get("value_error", "Invalid {field}" if is_en else "{field}格式不正确")
            messages.append(msg.format(field=field_cn))
        elif err_type == "missing":
            messages.append(error_messages["missing"].format(field=field_cn))
        else:
            # 回退：用原始消息
            raw_msg = err.get("msg", "Invalid input" if is_en else "输入有误")
            messages.append(f"{field_cn}{raw_msg}")

    detail = messages[0] if len(messages) == 1 else separator.join(messages)
    return JSONResponse(
        status_code=422,
        content={"detail": detail},
    )

# CORS 配置（支持 Web 和移动端）
# 开发模式允许所有localhost端口，生产模式使用白名单
cors_origins = settings.ALLOWED_ORIGINS
if settings.TESTING_MODE or settings.DEBUG:
    # 开发模式：允许所有来源（但不能与credentials同时使用*）
    # 所以使用具体的localhost端口列表
    cors_origins = [
        "http://localhost:3031",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3003",
        "http://localhost:3030",
        "http://localhost:3032",
        "http://localhost:3033",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:19000",
        "http://localhost:19006",
        "http://127.0.0.1:3031",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3030",
        "http://127.0.0.1:3032",
        "http://127.0.0.1:3033",
        # 局域网 IP（用于手机/Web 端访问）
        "http://192.168.1.110:8081",
        "http://192.168.1.110:8082",
        "http://192.168.1.110:19000",
        "http://192.168.1.110:19006",
        "http://192.168.1.114:8081",
        "http://192.168.1.114:8082",
        "http://192.168.1.114:19000",
        "http://192.168.1.114:19006",
    ]
logger.info(f"CORS origins configured: {cors_origins}, TESTING_MODE={settings.TESTING_MODE}, DEBUG={settings.DEBUG}")
for i, origin in enumerate(cors_origins):
    logger.info(f"  CORS origin [{i}]: '{origin}' (len={len(origin)})")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 注册路由（同时支持 /api 前缀，兼容 Web 端 Metro proxy）
routers = [
    (auth.router, "/auth", "认证"),
    (classrooms.router, "/classrooms", "课程"),
    (generate.router, "/generate", "生成"),
    (chat.router, "/chat", "聊天"),
    (media.router, "/media", "媒体"),
    (policies.router, "/policies", "政策"),
    (achievements.router, "/achievements", "成就"),
    (checkin.router, "/checkin", "打卡"),
    (sharing.router, "/sharing", "分享"),
    (classroom_sessions.router, "/sessions", "多人课堂"),
    (tokens.router, "/tokens", "Token"),
    (points.router, "/points", "积分"),
    (questions.router, "/questions", "问答"),
    (answers.router, "/answers", "回答"),
    (invitations.router, "/invitations", "邀请"),
]
for router, prefix, tag in routers:
    app.include_router(router, prefix=prefix, tags=[tag])
    app.include_router(router, prefix=f"/api{prefix}", tags=[tag])

extra_routers = [
    (payment.router, "/payment", "支付"),
    (subscriptions.router, "/subscriptions", "订阅"),
    (buddy.router, "/buddy", "学习搭子"),
    (notes.router, "/notes", "共享笔记"),
    (matching.router, "/matching", "学习匹配"),
    (gamification.router, "/gamification", "游戏化"),
    (recommendations.router, "/recommendations", "课程推荐"),
    (review.router, "/review", "间隔复习"),
    (passport.router, "/passport", "学习护照"),
]
for router, prefix, tag in extra_routers:
    app.include_router(router, prefix=prefix, tags=[tag])
    app.include_router(router, prefix=f"/api{prefix}", tags=[tag])

app.include_router(admin_full.router, tags=["管理后台"])
app.include_router(admin_auth.router, tags=["管理员认证"])
app.include_router(video_course.router, tags=["视频转课程"])
app.include_router(question_course.router, tags=["问题驱动课程"])
app.include_router(share_cards.router, tags=["社交分享卡片"])
app.include_router(personas.router, tags=["AI智能体"])
app.include_router(depth_levels.router, tags=["学习深度分层"])
app.include_router(programming.router, tags=["编程学习模板"])
app.include_router(note_reminders.router, tags=["笔记提醒系统"])
app.include_router(assessments.router, prefix="/assessments", tags=["学习效果测评"])
app.include_router(mistakes.router, tags=["错题复习"])
app.include_router(note_citations.router, tags=["笔记引用"])
app.include_router(enterprise.router, tags=["企业功能"])
app.include_router(tts.router, prefix="/tts", tags=["TTS"])
app.include_router(personal_notes.router, prefix="/personal-notes", tags=["个人笔记"])
app.include_router(profile.router, prefix="/profile", tags=["学习资料"])
app.include_router(learning.router, prefix="/learning", tags=["学习记录"])
app.include_router(knowledge.router, tags=["知识库"])
app.include_router(maic_ui_proxy.router, prefix="/maic-ui", tags=["MAIC-UI交互内容"])
app.include_router(quiz_router, prefix="/quiz-grade", tags=["quiz"])


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "version": "0.23.0"}