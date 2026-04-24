"""
生成路由 - 大纲/场景/异步作业/智能体/PDF解析/网络搜索
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.services.generation.outline_generator import generate_outlines, stream_outlines
from app.services.generation.scene_generator import generate_full_scene, generate_scene_content, generate_scene_actions
from app.services.generation.agent_generator import generate_agent_profiles, get_default_agents
from app.services.scene_service import (
    validate_language,
    validate_scene_count,
    SUPPORTED_LANGUAGES,
    MAX_TTS_TEXT_LENGTH,
    MAX_SCENES_PER_REQUEST,
)
from app.services.pdf_service import parse_pdf
from app.services.web_search_service import web_search_with_provider
from app.core.config import settings
import asyncpg
import uuid
import json
import asyncio
import logging
import time

router = APIRouter()
logger = logging.getLogger(__name__)


# TTS 配额限制（每个用户每天最多 TTS 请求次数）
TTS_DAILY_LIMIT = 100
TTS_MONTHLY_LIMIT = 1000


def validate_tts_quota(user_id: str, db: asyncpg.Connection) -> bool:
    """
    验证用户 TTS 配额（预留接口，实际实现需要配额表）

    Args:
        user_id: 用户 ID
        db: 数据库连接

    Returns:
        是否有配额
    """
    # TODO: 实现基于数据库的配额检查
    # 目前简单返回 True，后续可添加 usage_tracking 表
    return True


# ==================== PDF 解析 ====================

@router.post("/parse-pdf")
async def parse_pdf_endpoint(
    pdf: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id),
    providerId: Optional[str] = None,
    apiKey: Optional[str] = None,
    baseUrl: Optional[str] = None,
):
    """
    解析 PDF 文件

    参数:
    - pdf: PDF 文件
    - providerId: 解析器类型 (pypdf, llm-vision)
    - apiKey: OCR/Vision API key
    - baseUrl: API base URL
    """
    # 读取 PDF 文件
    pdf_bytes = await pdf.read()

    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="PDF file is empty")

    # 验证文件类型
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    logger.info(f"[PDF] Parsing: {pdf.filename}, size={len(pdf_bytes)}, provider={providerId}")

    try:
        result = await parse_pdf(
            pdf_bytes=pdf_bytes,
            provider_id=providerId,
            api_key=apiKey,
            base_url=baseUrl,
        )

        logger.info(f"[PDF] Parsed successfully: text_len={len(result['text'])}, images={len(result['images'])}")

        return {
            "success": True,
            "data": {
                "text": result["text"],
                "images": result["images"],
                "metadata": result["metadata"],
            }
        }
    except Exception as e:
        logger.error(f"[PDF] Parse failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 网络搜索 ====================

@router.post("/web-search")
async def web_search_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    执行网络搜索

    参数:
    - query: 搜索查询
    - pdfText: PDF 文本（用于增强搜索）
    - apiKey: 搜索 API key
    - provider: 搜索提供商 (serper, google)
    """
    query = body.get("query", "")
    if not query.strip():
        raise HTTPException(status_code=400, detail="搜索查询不能为空")

    pdf_text = body.get("pdfText")
    api_key = body.get("apiKey")
    provider = body.get("provider", "serper")

    logger.info(f"[WebSearch] Query: {query[:50]}, provider={provider}")

    try:
        result = await web_search_with_provider(
            query=query,
            provider=provider,
            api_key=api_key,
            pdf_text=pdf_text,
        )

        logger.info(f"[WebSearch] Found {len(result['sources'])} sources")

        return {
            "success": True,
            "sources": result["sources"],
            "context": result["context"],
            "provider": result.get("provider", provider),
        }
    except Exception as e:
        logger.error(f"[WebSearch] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 大纲生成 ====================

@router.post("/outlines")
async def generate_outlines_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成大纲（返回 JSON）"""
    requirement = body.get("requirement", "")
    pdf_content = body.get("pdf_content")
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)
    agent_ids = body.get("agent_ids", [])
    web_search = body.get("web_search", False)

    try:
        outlines = await generate_outlines(
            requirement=requirement,
            pdf_content=pdf_content,
            language=language,
            model=model,
            agent_ids=agent_ids,
            web_search=web_search,
        )
        return {"outlines": [o.model_dump() for o in outlines]}
    except Exception as e:
        # LLM调用失败，返回智能默认大纲
        import logging
        logging.warning(f"大纲生成失败: {e}")
        from app.services.generation.outline_generator import SceneOutline, generate_smart_default_outlines
        default_outlines = generate_smart_default_outlines(requirement, language, agent_ids)
        return {"outlines": [o.model_dump() for o in default_outlines]}


@router.post("/outlines-stream")
async def generate_outlines_stream_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成大纲（SSE 流式，快速返回标题列表）"""
    # 参数验证
    requirement = body.get("requirement", "")
    if not requirement.strip():
        raise HTTPException(status_code=400, detail="课程需求不能为空")

    total_count = body.get("total_count", 5)
    if total_count < 1 or total_count > 20:
        raise HTTPException(status_code=400, detail="大纲数量必须在1-20之间")

    start_time = time.time()
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)
    agent_ids = body.get("agent_ids", [])

    logger.info(f"[SSE] 开始生成大纲 - 用户: {current_user_id}, 数量: {total_count}")

    async def event_stream():
        try:
            # 快速生成大纲标题列表（一次性LLM调用）
            from app.services.generation.outline_generator import generate_outline_titles, SceneOutline
            import uuid

            logger.info(f"[SSE] 步骤1: 生成大纲标题列表")
            outline_titles = await generate_outline_titles(
                requirement, language, model, total_count
            )

            elapsed = time.time() - start_time
            logger.info(f"[SSE] 标题列表完成 - {len(outline_titles)} 个 (耗时: {elapsed:.1f}s)")

            # 直接返回标题列表作为大纲（快速响应）
            index = 0
            for i, outline_info in enumerate(outline_titles):
                index += 1
                # 创建大纲对象（标题、类型、描述）
                outline = SceneOutline(
                    id=str(uuid.uuid4()),
                    title=outline_info.get("title", f"场景 {i+1}"),
                    type=outline_info.get("type", "slide"),
                    description=outline_info.get("description", ""),
                    order=i + 1,
                    key_points=[],  # 详细内容在创建幻灯片时生成
                )

                logger.info(f"[SSE] 发送大纲 #{index}: {outline.title}")
                yield f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n"
                await asyncio.sleep(0.05)  # 短暂延迟确保客户端接收

            total_elapsed = time.time() - start_time
            logger.info(f"[SSE] 完成 - 共 {index} 个大纲 (总耗时: {total_elapsed:.1f}s)")
            yield f"event: done\ndata: {json.dumps({'count': index})}\n\n"

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[SSE] 生成失败 (耗时: {elapsed:.1f}s): {e}")
            # 失败时返回默认大纲
            from app.services.generation.outline_generator import SceneOutline, generate_smart_default_outlines
            default_outlines = generate_smart_default_outlines(requirement, language, agent_ids)
            for outline in default_outlines:
                yield f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n"
            yield f"event: done\ndata: {json.dumps({'count': len(default_outlines)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


@router.post("/scenes")
async def generate_scenes_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成场景内容"""
    outlines = body.get("outlines", [])
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)

    scenes = []
    for outline in outlines:
        scene = await generate_full_scene(
            outline=outline,
            language=language,
            model=model,
        )
        scenes.append(scene)

    return {"scenes": scenes}


@router.post("/agent-profiles")
async def generate_agent_profiles_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    生成智能体配置（根据课程信息和大纲）

    支持两种参数格式：
    1. Web 版格式:
       - stageInfo: { name, description }
       - language
       - availableAvatars: 头像路径列表
       - avatarDescriptions: 头像描述列表
       - availableVoices: 可用语音列表

    2. 移动端格式:
       - stage_name
       - stage_description
       - scene_outlines
       - language
       - model
    """
    # 兼容 Web 版参数
    stage_info = body.get("stageInfo")
    if stage_info:
        stage_name = stage_info.get("name", "课程")
        stage_description = stage_info.get("description")
    else:
        # 移动端参数
        stage_name = body.get("stage_name", "课程")
        stage_description = body.get("stage_description")

    scene_outlines = body.get("scene_outlines", [])
    language = validate_language(body.get("language", "zh-CN"))
    model = body.get("model", settings.DEFAULT_MODEL)

    # Web 版特有参数（头像和语音）
    available_avatars = body.get("availableAvatars", [])
    avatar_descriptions = body.get("avatarDescriptions", [])
    available_voices = body.get("availableVoices", [])

    agents = await generate_agent_profiles(
        stage_name=stage_name,
        stage_description=stage_description,
        scene_outlines=scene_outlines,
        language=language,
        model=model,
    )

    # 如果有头像参数，进行匹配
    if available_avatars and agents:
        for i, agent in enumerate(agents):
            if i < len(available_avatars):
                agent.avatar = available_avatars[i]
            # 如果有描述，也添加
            if avatar_descriptions and i < len(avatar_descriptions):
                desc = avatar_descriptions[i]
                if isinstance(desc, dict):
                    agent.avatar_description = desc.get("desc", "")
            # 如果有语音配置，添加
            if available_voices and i < len(available_voices):
                voice = available_voices[i]
                if isinstance(voice, dict):
                    agent.voice_provider = voice.get("providerId", "openai")
                    agent.voice_id = voice.get("voiceId", "alloy")

    return {"agents": [a.model_dump() for a in agents]}


@router.get("/default-agents")
async def get_default_agents_endpoint(
    language: str = "zh-CN"
):
    """获取默认智能体配置（无需认证）"""
    agents = get_default_agents(language)
    return {"agents": [a.model_dump() for a in agents]}


@router.post("/classroom")
async def generate_classroom_async(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """异步生成课程"""
    job_id = uuid.uuid4()

    # 创建作业记录
    await db.execute(
        """
        INSERT INTO generation_jobs (id, user_id, status, step, progress, message, input_summary)
        VALUES ($1, $2, 'queued', 'queued', 0, '作业已创建', $3)
        """,
        job_id,
        uuid.UUID(current_user_id),
        json.dumps({
            "requirement_preview": body.get("requirement", "")[:200],
            "language": body.get("language", "zh-CN")
        })
    )

    return {
        "job_id": str(job_id),
        "status": "queued",
        "poll_url": f"/generate/classroom/{job_id}"
    }


@router.get("/classroom/{job_id}")
async def get_generation_job(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """查询生成作业状态"""
    row = await db.fetchrow(
        """
        SELECT id, user_id, status, step, progress, message, result, error
        FROM generation_jobs
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(job_id),
        uuid.UUID(current_user_id)
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": str(row["id"]),
        "status": row["status"],
        "step": row["step"],
        "progress": row["progress"],
        "message": row["message"],
        "result": row["result"],
        "error": row["error"]
    }


@router.post("/tts")
async def generate_tts_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    生成 TTS 音频（返回 base64）

    参数:
    - text: 要转换的文本（必填，最大 4000 字符）
    - audio_id: 音频 ID（必填）
    - provider: TTS 提供商 (openai, minimax)
    - voice: 语音 ID
    - speed: 语速 (0.25-4.0)
    - model: TTS 模型
    """
    from app.services.tts_service import generate_tts, encode_audio_base64

    text = body.get("text", "")
    audio_id = body.get("audio_id", "")
    provider = body.get("provider", "openai")
    voice = body.get("voice", "alloy")
    speed = body.get("speed", 1.0)
    model = body.get("model", "tts-1")

    # 必填参数验证
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if not audio_id:
        raise HTTPException(status_code=400, detail="audio_id is required")

    # 文本长度限制（防止滥用和过高成本）
    if len(text) > MAX_TTS_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text too long. Maximum {MAX_TTS_TEXT_LENGTH} characters allowed."
        )

    # TTS 提供商白名单验证
    supported_providers = ["openai", "minimax"]
    if provider not in supported_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported TTS provider. Supported: {supported_providers}"
        )

    # 配额检查
    if not validate_tts_quota(current_user_id, db):
        raise HTTPException(
            status_code=429,
            detail="TTS quota exceeded. Please try again later."
        )

    logger.info(f"[TTS] Generating audio: id={audio_id}, provider={provider}, voice={voice}, len={len(text)}")

    try:
        result = await generate_tts(
            text=text,
            provider=provider,
            voice=voice,
            speed=speed,
            model=model,
        )

        base64_audio = encode_audio_base64(result["audio"])

        logger.info(f"[TTS] Generated successfully: id={audio_id}, format={result['format']}")

        return {
            "audio_id": audio_id,
            "base64": base64_audio,
            "format": result["format"],
        }
    except Exception as e:
        logger.error(f"[TTS] Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 分步场景生成 ====================

@router.post("/scene-content")
async def generate_scene_content_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    生成单个场景内容（不含 Actions）

    参数:
    - outline: 场景大纲 (dict)
    - allOutlines: 所有大纲（用于上下文）
    - pdfImages: PDF 图像列表
    - imageMapping: 图像映射
    - stageInfo: 课程信息
    - stageId: 课程 ID
    - agents: 智能体列表
    """
    from app.services.generation.outline_generator import SceneOutline

    outline_dict = body.get("outline")
    if not outline_dict:
        raise HTTPException(status_code=400, detail="outline is required")

    # 转换为 SceneOutline 对象
    outline = SceneOutline(
        id=outline_dict.get("id", str(uuid.uuid4())),
        title=outline_dict.get("title", ""),
        type=outline_dict.get("type", "slide"),
        description=outline_dict.get("description", ""),
        order=outline_dict.get("order", 1),
        key_points=outline_dict.get("key_points", []),
    )

    stage_info = body.get("stageInfo", {})
    language = validate_language(stage_info.get("language", "zh-CN"))
    model = settings.DEFAULT_MODEL

    logger.info(f"[SceneContent] Generating: {outline.title}")

    try:
        content = await generate_scene_content(
            outline=outline,
            language=language,
            model=model,
        )

        logger.info(f"[SceneContent] Generated successfully")

        return {
            "success": True,
            "content": content,
            "effectiveOutline": outline_dict,
        }
    except Exception as e:
        logger.error(f"[SceneContent] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scene-actions")
async def generate_scene_actions_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    生成场景动作（Speech, Spotlight 等）

    参数:
    - outline: 场景大纲 (dict)
    - allOutlines: 所有大纲
    - content: 场景内容
    - stageId: 课程 ID
    - agents: 智能体列表
    - previousSpeeches: 之前的 speech 文本（用于连贯性）
    - userProfile: 用户信息（用于个性化）
    """
    from app.services.generation.outline_generator import SceneOutline

    outline_dict = body.get("outline")
    if not outline_dict:
        raise HTTPException(status_code=400, detail="outline is required")

    content = body.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    # 转换为 SceneOutline 对象
    outline = SceneOutline(
        id=outline_dict.get("id", str(uuid.uuid4())),
        title=outline_dict.get("title", ""),
        type=outline_dict.get("type", "slide"),
        description=outline_dict.get("description", ""),
        order=outline_dict.get("order", 1),
        key_points=outline_dict.get("key_points", []),
    )

    language = "zh-CN"
    model = settings.DEFAULT_MODEL

    logger.info(f"[SceneActions] Generating for: {outline.title}")

    try:
        actions = await generate_scene_actions(
            outline=outline,
            content=content,
            language=language,
            model=model,
        )

        # 构建场景数据
        scene = {
            "id": str(uuid.uuid4()),
            "type": outline.type,
            "title": outline.title,
            "order": outline.order,
            "content": content,
            "actions": [a.model_dump() for a in actions],
        }

        logger.info(f"[SceneActions] Generated {len(actions)} actions")

        return {
            "success": True,
            "scene": scene,
        }
    except Exception as e:
        logger.error(f"[SceneActions] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 一体化场景生成 ====================

@router.post("/scene-with-actions")
async def generate_scene_with_actions_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成完整场景（内容 + Actions + TTS）"""
    from app.services.generation.scene_generator import (
        generate_scene_content,
        generate_scene_actions,
        Action,
    )
    from app.services.tts_service import generate_tts, encode_audio_base64

    outline = body.get("outline")
    agents = body.get("agents", [])
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)
    generate_tts_audio = body.get("generate_tts", True)  # 是否预生成 TTS
    tts_provider = body.get("tts_provider", "openai")
    tts_voice = body.get("tts_voice", "alloy")

    if not outline:
        raise HTTPException(status_code=400, detail="outline is required")

    logger.info(f"[Scene] Generating scene with actions: {outline.get('title', 'unknown')}")

    # 1. 生成场景内容
    content = await generate_scene_content(outline, language, model)

    # 2. 生成 Actions
    actions = await generate_scene_actions(outline, content, language, model)

    # 3. 为 speech 动作预生成 TTS（可选）
    actions_data = []
    for action in actions:
        action_dict = action.model_dump()

        if action.type == "speech" and generate_tts_audio:
            text = action.data.get("text", "")
            audio_id = f"tts_{action.id}"

            try:
                tts_result = await generate_tts(
                    text=text,
                    provider=tts_provider,
                    voice=tts_voice,
                )
                action_dict["data"]["audio_id"] = audio_id
                action_dict["data"]["audio_base64"] = encode_audio_base64(tts_result["audio"])
                action_dict["data"]["audio_format"] = tts_result["format"]

                logger.info(f"[Scene] TTS generated for action {action.id}")
            except Exception as e:
                logger.warning(f"[Scene] TTS generation failed for action {action.id}: {e}")
                # TTS 失败不影响场景生成，继续处理

        actions_data.append(action_dict)

    scene = {
        "id": str(uuid.uuid4()),
        "type": outline.get("type", "slide"),
        "title": outline.get("title", ""),
        "order": outline.get("order", 1),
        "content": content,
        "actions": actions_data,
    }

    logger.info(f"[Scene] Generated successfully: {len(actions_data)} actions")

    return {"scene": scene}