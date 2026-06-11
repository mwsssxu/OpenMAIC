"""
生成路由 - 大纲/场景/异步作业/智能体/PDF解析/网络搜索
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional
from app.middleware.auth import get_current_user_id
from app.db.database import get_db
from app.services.generation.outline_generator import (
    generate_outlines,
    stream_outlines,
    stream_generate_outlines,
    generate_outline_titles,
    generate_single_outline,
    generate_smart_default_outlines,
    uniquify_media_element_ids,
    SceneOutline,
)
from app.services.generation.scene_generator import (
    generate_full_scene,
    generate_scene_content,
    generate_scene_actions,
    Action,
)
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
from app.services.tts_service import generate_tts, encode_audio_base64
from app.services.llm import call_llm
from app.services.generation.prompts import build_prompt
from app.core.config import settings
from app.core.ssrf_guard import validate_url_for_ssrf
import asyncpg
import uuid
import json
import asyncio
import logging
import re
import time

router = APIRouter()
logger = logging.getLogger(__name__)


# TTS 配额限制（每个用户每天最多 TTS 请求次数）
TTS_DAILY_LIMIT = 100
TTS_MONTHLY_LIMIT = 1000


def has_vision_capability(model: str) -> bool:
    """
    检测模型是否支持视觉能力

    Args:
        model: 模型标识（如 "openai/gpt-4o", "gpt-4o-mini", "glm-4v"）

    Returns:
        是否支持视觉输入
    """
    # 提取模型名称（去除前缀）
    model_name = model.split("/")[-1] if "/" in model else model

    # 检查配置映射
    capabilities = settings.MODEL_CAPABILITIES.get(
        model_name, settings.DEFAULT_MODEL_CAPABILITIES
    )
    return capabilities.get("vision", False)


def get_model_max_tokens(model: str) -> int:
    """
    获取模型最大输出 token 数

    Args:
        model: 模型标识

    Returns:
        最大输出 token 数
    """
    model_name = model.split("/")[-1] if "/" in model else model
    capabilities = settings.MODEL_CAPABILITIES.get(
        model_name, settings.DEFAULT_MODEL_CAPABILITIES
    )
    return capabilities.get("max_output_tokens", 2048)


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

    # SSRF 验证 baseUrl
    if baseUrl:
        ssrf_error = validate_url_for_ssrf(baseUrl)
        if ssrf_error:
            raise HTTPException(status_code=400, detail=ssrf_error)

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


# ==================== 课程缓存匹配 ====================

@router.post("/match-cache")
async def match_course_cache(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    语义匹配已有课程缓存
    - 命中时返回大纲和场景摘要，供用户选择复用或微调
    - 未命中时返回 null，前端继续正常生成流程
    """
    requirement = body.get("requirement", "").strip()
    language = body.get("language", "zh-CN")

    if not requirement:
        raise HTTPException(status_code=400, detail="requirement is required")

    from app.services.course_cache import find_matching_course

    match = await find_matching_course(requirement, db, language)

    if match:
        # 更新使用计数
        await db.execute(
            "UPDATE course_cache SET use_count = use_count + 1 WHERE id = $1",
            uuid.UUID(match["cache_id"]),
        )
        return {
            "matched": True,
            "data": match,
        }
    else:
        return {
            "matched": False,
            "data": None,
        }


@router.post("/cache-course")
async def cache_course_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    将已生成的课程写入缓存（供后续语义匹配复用）
    """
    stage_id = body.get("stage_id")
    requirement = body.get("requirement", "").strip()
    outlines = body.get("outlines", [])
    scenes = body.get("scenes", [])
    language = body.get("language", "zh-CN")

    if not stage_id or not requirement:
        raise HTTPException(status_code=400, detail="stage_id and requirement are required")

    from app.services.course_cache import cache_course

    cache_id = await cache_course(
        requirement=requirement,
        stage_id=uuid.UUID(stage_id),
        outlines=outlines,
        scenes=scenes,
        db=db,
        language=language,
    )

    if cache_id:
        return {"success": True, "cache_id": cache_id}
    else:
        raise HTTPException(status_code=500, detail="Failed to cache course")


@router.post("/load-cache-scenes")
async def load_cache_scenes(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """
    从缓存的源课程加载完整 scenes 数据（用于复用）
    """
    stage_id = body.get("stage_id")
    if not stage_id:
        raise HTTPException(status_code=400, detail="stage_id is required")

    from app.services.course_cache import load_cached_course_scenes

    scenes = await load_cached_course_scenes(uuid.UUID(stage_id), db)
    return {"scenes": scenes}


# ==================== 网络搜索 ====================

def _extract_rewritten_query(raw: str) -> Optional[str]:
    """从 LLM 原始输出中提取 {"query":"..."} 的 query 字段。

    兼容场景：
    - 带 markdown 代码块的 ```json {...} ```
    - 纯 JSON 文本
    - 解析失败时返回 None
    """
    if not raw:
        return None
    # 仅剤除首尾的围栏，避免损坏 query 内部的反引号
    text = re.sub(r"^```(?:json)?\s*|\s*```\s*$", "", raw.strip(), flags=re.S).strip()
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    snippet = text[start:end + 1]
    try:
        obj = json.loads(snippet)
    except Exception:
        return None
    value = obj.get("query") if isinstance(obj, dict) else None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return None


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
    # 默认不开启查询重写；前端可显式设置 rewriteQuery=true 开启
    # （避免在常见 pdfText 场景下隐式新增一次 LLM 调用）
    rewrite_query = body.get("rewriteQuery", False)

    logger.info(f"[WebSearch] Query: {query[:50]}, provider={provider}")

    # 当有 pdfText 且开启重写时，调用 web-search-query-rewrite 模板将 query 优化为具体搜索词
    effective_query = query
    if rewrite_query and pdf_text and pdf_text.strip():
        try:
            sys_p, usr_p = build_prompt(
                "web-search-query-rewrite",
                {
                    "requirement": query,
                    "pdfExcerpt": pdf_text[:4000],
                },
            )
            if sys_p and usr_p:
                raw = await call_llm(
                    prompt=usr_p,
                    system_prompt=sys_p,
                    temperature=0.2,
                    max_tokens=256,
                )
                rewritten = _extract_rewritten_query(raw)
                if rewritten and len(rewritten) <= 320:
                    logger.info(f"[WebSearch] Query rewritten: {query[:30]!r} -> {rewritten[:30]!r}")
                    effective_query = rewritten
        except Exception as rewrite_err:
            logger.warning(f"[WebSearch] query rewrite failed, use original: {rewrite_err}")

    try:
        result = await web_search_with_provider(
            query=effective_query,
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
    """生成大纲（使用Web端一致的prompt模板）"""
    requirement = body.get("requirement", "")
    pdf_content = body.get("pdf_content")
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)
    agent_ids = body.get("agent_ids", [])
    agents = body.get("agents", [])  # 完整agent信息（与Web端一致）
    web_search = body.get("web_search", False)
    web_search_context = body.get("web_search_context")  # 网络搜索结果

    try:
        outlines = await generate_outlines(
            requirement=requirement,
            pdf_content=pdf_content,
            language=language,
            model=model,
            agent_ids=agent_ids,
            web_search=web_search,
            web_search_context=web_search_context,
            agents=agents,  # 传递完整agent信息用于构建teacherContext
        )
        # 确保mediaGenerations的elementId全局唯一
        outlines = uniquify_media_element_ids(outlines)
        return {"outlines": [o.model_dump() for o in outlines]}
    except Exception as e:
        # LLM调用失败，返回智能默认大纲
        logger.warning(f"大纲生成失败: {e}")
        default_outlines = generate_smart_default_outlines(requirement, language, agent_ids)
        return {"outlines": [o.model_dump() for o in default_outlines]}


@router.post("/outlines-stream")
async def generate_outlines_stream_endpoint(
    body: dict,
    current_user_id: str = Depends(get_current_user_id)
):
    """生成大纲（SSE 流式，带 heartbeat 和自动重试）"""
    # 参数验证
    requirement = body.get("requirement", "")
    if not requirement.strip() and not body.get("pdf_content"):
        raise HTTPException(status_code=400, detail="课程需求不能为空")

    total_count = body.get("total_count", 5)
    if total_count < 1 or total_count > 20:
        raise HTTPException(status_code=400, detail="大纲数量必须在1-20之间")

    start_time = time.time()
    language = body.get("language", "zh-CN")
    model = body.get("model", settings.DEFAULT_MODEL)
    agent_ids = body.get("agent_ids", [])
    agents = body.get("agents", [])  # 完整agent信息（与Web端一致）
    web_search = body.get("web_search", False)
    web_search_context = body.get("web_search_context")
    pdf_content = body.get("pdf_content")

    logger.info(f"[SSE] 开始生成大纲 - 用户: {current_user_id}, 数量: {total_count}")
    logger.info(f"[SSE] 参数: agents={len(agents)}, web_search={web_search}")

    # Heartbeat 配置
    HEARTBEAT_INTERVAL_MS = 15000  # 15秒心跳
    MAX_STREAM_RETRIES = 2  # 最大重试次数

    async def event_stream_with_heartbeat():
        queue = asyncio.Queue()
        stop_signal = object()
        parsed_outlines = []

        # Heartbeat producer
        async def heartbeat_producer():
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL_MS / 1000)
                try:
                    await queue.put(":heartbeat\n\n")
                except asyncio.QueueFull:
                    pass

        # Outline producer - 与Web端一致：使用真正的流式LLM调用
        async def outline_producer():
            last_error = None
            try:
                for attempt in range(1, MAX_STREAM_RETRIES + 2):
                    try:
                        logger.info(f"[SSE] 尝试 #{attempt}/{MAX_STREAM_RETRIES + 1}")

                        # 使用 stream_generate_outlines 真正流式生成（与Web端一致）
                        outline_count = 0
                        async for outline in stream_generate_outlines(
                            requirement=requirement,
                            pdf_content=pdf_content,
                            language=language,
                            model=model,
                            agent_ids=agent_ids,
                            web_search=web_search,
                            web_search_context=web_search_context,
                            agents=agents,  # 传递完整agent信息用于构建teacherContext
                        ):
                            outline_count += 1
                            parsed_outlines.append(outline)
                            # 实时发送每个大纲（真正的流式）
                            await queue.put(f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n")
                            logger.info(f"[SSE] 大纲 #{outline_count} 发送 - {outline.title}")

                        if outline_count > 0:
                            total_elapsed = time.time() - start_time
                            logger.info(f"[SSE] 完成 - 共 {outline_count} 个大纲 (总耗时: {total_elapsed:.1f}s)")
                            await queue.put(f"event: done\ndata: {json.dumps({'count': outline_count, 'outlines': [o.model_dump() for o in parsed_outlines]})}\n\n")
                            await queue.put(stop_signal)
                            return

                        last_error = "LLM returned empty response"
                        if attempt <= MAX_STREAM_RETRIES:
                            logger.warning(f"[SSE] 空结果，重试 #{attempt}")
                            await queue.put(f"event: retry\ndata: {json.dumps({'attempt': attempt, 'maxAttempts': MAX_STREAM_RETRIES + 1})}\n\n")
                            await asyncio.sleep(2)

                    except Exception as e:
                        last_error = str(e)
                        elapsed = time.time() - start_time
                        logger.warning(f"[SSE] 错误 #{attempt} (耗时: {elapsed:.1f}s): {e}")
                        if attempt <= MAX_STREAM_RETRIES:
                            await queue.put(f"event: retry\ndata: {json.dumps({'attempt': attempt, 'maxAttempts': MAX_STREAM_RETRIES + 1})}\n\n")
                            await asyncio.sleep(2)

                # 所有重试失败，返回默认大纲
                logger.error(f"[SSE] 所有重试失败: {last_error}")
                default_outlines = generate_smart_default_outlines(requirement, language, agent_ids)
                for outline in default_outlines:
                    await queue.put(f"event: outline\ndata: {json.dumps(outline.model_dump())}\n\n")
                await queue.put(f"event: done\ndata: {json.dumps({'count': len(default_outlines)})}\n\n")
                await queue.put(stop_signal)

            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(f"[SSE] 生成失败 (耗时: {elapsed:.1f}s): {e}")
                await queue.put(f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n")
                await queue.put(stop_signal)

        # 启动 producer 任务
        heartbeat_task = asyncio.create_task(heartbeat_producer())
        outline_task = asyncio.create_task(outline_producer())

        # 从 queue 消费并 yield
        try:
            while True:
                item = await queue.get()
                if item is stop_signal:
                    break
                yield item
        finally:
            heartbeat_task.cancel()
            outline_task.cancel()

    return StreamingResponse(
        event_stream_with_heartbeat(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
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
    text = body.get("text", "")
    audio_id = body.get("audio_id", "")
    provider = body.get("provider", "qwen")  # 默认使用 DashScope TTS
    voice = body.get("voice", "zhichu")  # DashScope Sambert 默认语音
    speed = body.get("speed", 1.0)
    model = body.get("model", "sambert-zhichu-v1")  # DashScope Sambert 模型

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
    supported_providers = ["qwen", "openai", "minimax"]  # qwen 为 DashScope TTS
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

    # 检测视觉能力
    vision_enabled = has_vision_capability(model)
    pdf_images = body.get("pdfImages", [])

    # 如果模型不支持视觉且有图像，记录警告
    if pdf_images and not vision_enabled:
        logger.warning(f"[SceneContent] Model {model} doesn't support vision, {len(pdf_images)} images will be ignored")

    logger.info(f"[SceneContent] Generating: {outline.title}, vision={vision_enabled}")

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
            "modelCapabilities": {
                "vision": vision_enabled,
                "maxTokens": get_model_max_tokens(model),
            },
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