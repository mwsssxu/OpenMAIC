"""
MAIC-UI 代理路由 - 调用 MAIC-UI 服务生成交互式学习内容

MAIC-UI 是一个独立的 AI 交互教学界面生成系统，提供：
- PDF/PPT 上传和解析
- 交互式网站生成
- 知识卡片生成
- 概念内容生成（无需上传文件）

使用方式：
1. 配置 MAIC_UI_URL 和 MAIC_UI_ENABLED
2. 移动端课程创建时可调用此代理获取交互内容
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.middleware.auth import get_current_user_id
from app.core.config import settings
import httpx
import json
import logging
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

# MAIC-UI 服务账户 token（从配置获取，模块级别缓存）
# 生产环境应配置 MAIC_UI_SERVICE_TOKEN 环境变量
_SERVICE_TOKEN: Optional[str] = None

def get_service_token() -> str:
    """获取 MAIC-UI 服务令牌（缓存）"""
    global _SERVICE_TOKEN
    if _SERVICE_TOKEN is None:
        _SERVICE_TOKEN = settings.MAIC_UI_SERVICE_TOKEN
        if not _SERVICE_TOKEN:
            logger.warning("⚠️ MAIC_UI_SERVICE_TOKEN not configured - MAIC-UI calls may fail")
    return _SERVICE_TOKEN


# ============================================================================
# Pydantic Request Models
# ============================================================================

class ConceptRequest(BaseModel):
    """概念内容生成请求模型"""
    model_config = ConfigDict(extra="allow")  # Pydantic v2: 允许额外字段

    concept: Optional[str] = Field(None, description="概念/主题描述")
    title: Optional[str] = Field(None, description="内容标题")
    subject: Optional[str] = Field("综合学习", description="学科")
    grade_level: Optional[int] = Field(None, ge=1, le=12, description="年级(1-12)")
    description: Optional[str] = Field("", description="详细描述")

    # 完整格式字段（可选）
    concept_name: Optional[str] = Field(None, description="概念名称")
    concept_overview: Optional[str] = Field(None, description="概念概述")
    mastery_points: Optional[str] = Field(None, description="掌握要点")
    design_idea: Optional[str] = Field(None, description="设计理念")


class TemplateSearchRequest(BaseModel):
    """模板搜索请求模型"""
    concept: str = Field(..., description="概念描述")
    limit: int = Field(5, ge=1, le=20, description="返回数量限制")


class GenerateWithTemplateRequest(BaseModel):
    """使用模板生成请求模型"""
    concept: str = Field(..., description="概念描述")
    template_id: str = Field(..., description="模板 ID")


def get_maic_ui_client() -> httpx.AsyncClient:
    """获取 MAIC-UI API 客户端"""
    if not settings.MAIC_UI_URL:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务未配置")
    return httpx.AsyncClient(
        base_url=settings.MAIC_UI_URL,
        timeout=httpx.Timeout(300.0, connect=30.0)  # 5分钟超时（MAIC-UI 处理可能较慢）
    )


async def call_maic_ui_with_retry(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> httpx.Response:
    """带重试机制的 MAIC-UI API 联用

    重试策略：
    - 连接错误（RequestError）：指数退避重试
    - HTTP 5xx 错误：指数退避重试
    - HTTP 4xx 错误：不重试（客户端错误）
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if method == "GET":
                response = await client.get(url, **kwargs)
            else:
                response = await client.post(url, **kwargs)

            # 检查 HTTP 状态码，5xx 错误触发重试
            if response.status_code >= 500:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(
                        f"MAIC-UI returned {response.status_code} (attempt {attempt + 1}), "
                        f"retrying in {wait_time}s"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                # 最后一次尝试，返回错误响应
                logger.error(f"MAIC-UI returned {response.status_code} after {max_retries} attempts")
            return response

        except httpx.RequestError as e:
            # 连接错误处理
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.warning(
                    f"MAIC-UI request failed (attempt {attempt + 1}), "
                    f"retrying in {wait_time}s: {e}"
                )
                await asyncio.sleep(wait_time)
            else:
                raise


@router.get("/health")
async def check_maic_ui_health():
    """检查 MAIC-UI 服务健康状态"""
    if not settings.MAIC_UI_ENABLED:
        return {"status": "disabled", "message": "MAIC-UI 集成未启用"}

    try:
        async with get_maic_ui_client() as client:
            response = await client.get("/health")
            return {
                "status": "connected",
                "maic_ui_status": response.json(),
                "url": settings.MAIC_UI_URL
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/concept")
async def generate_concept_content(
    body: ConceptRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    根据概念描述生成交互式学习内容（无需上传文件）

    适用于移动端课程场景生成：
    - 输入：课程主题/知识点描述
    - 输出：交互式 HTML 内容

    参数（两种格式）：
    1. 简化格式（自动扩展）：
       - concept: 概念/主题描述（如 "光合作用的基本过程"）
       - title: 内容标题
       - grade_level: 年级（可选，1-12）

    2. 完整格式（直接传递）：
       - subject: 学科
       - concept_name: 概念名称
       - concept_overview: 概念概述
       - mastery_points: 掌握要点
       - design_idea: 设计理念
    """
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    # 检查是否使用完整格式
    if body.subject and body.concept_name:
        subject = body.subject
        concept_name = body.concept_name
        concept_overview = body.concept_overview or ""
        mastery_points = body.mastery_points or "[]"
        design_idea = body.design_idea or ""
        grade_level = body.grade_level
    else:
        # 使用简化格式，自动扩展
        concept = body.concept
        if not concept:
            raise HTTPException(status_code=400, detail="concept 参数必填")

        title = body.title or concept
        grade_level = body.grade_level

        # 自动生成参数
        subject = body.subject or "综合学习"
        concept_name = title[:50]  # 取标题前50字符作为概念名称
        concept_overview = concept  # 使用完整描述作为概述
        mastery_points = "[]"  # 空的掌握要点，让 AI 自动生成
        design_idea = "交互式学习，适合移动端浏览"  # 默认设计理念

    try:
        async with get_maic_ui_client() as client:
            # 调用 MAIC-UI 的概念上传 API，使用服务账户认证
            response = await call_maic_ui_with_retry(
                client, "POST",
                "/api/pdf/concept/upload",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"},
                data={
                    "subject": subject,
                    "concept_name": concept_name,
                    "concept_overview": concept_overview,
                    "mastery_points": mastery_points,
                    "design_idea": design_idea,
                    "grade_level": grade_level or "",
                    "description": body.description or "",
                    "is_public": "false",
                    "include_exercises": "true",
                    "include_prerequisites": "true",
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "MAIC-UI 请求失败")
                )

            result = response.json()
            return {
                "document_id": result.get("id"),
                "status": result.get("status"),
                "title": result.get("title"),
                "message": "内容正在生成，请稍后查询状态"
            }

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.get("/documents/{document_id}/status")
async def get_document_status(
    document_id: int,
    current_user_id: str = Depends(get_current_user_id)
):
    """获取 MAIC-UI 文档处理状态"""
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    try:
        async with get_maic_ui_client() as client:
            response = await call_maic_ui_with_retry(
                client, "GET",
                f"/api/pdf/documents/{document_id}/processing-status",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"}
            )
            return response.json()

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.get("/documents/{document_id}/website")
async def get_generated_website(
    document_id: int,
    current_user_id: str = Depends(get_current_user_id)
):
    """获取生成的交互式网站内容"""
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    try:
        async with get_maic_ui_client() as client:
            response = await call_maic_ui_with_retry(
                client, "GET",
                f"/api/pdf/documents/{document_id}/website",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"}
            )
            return response.json()

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.post("/pdf/upload")
async def upload_pdf_to_maic_ui(
    file: UploadFile = File(...),
    title: str = Form(...),
    grade_level: Optional[int] = Form(None),
    generation_mode: str = Form("fast"),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    上传 PDF 到 MAIC-UI 进行处理

    用于课程素材上传场景：
    - 教师 PDF 教案 → 交互式课件
    - 学习资料 → 可交互内容

    处理流程：
    1. 上传 PDF → MAIC-UI 异步处理
    2. 返回 document_id
    3. 后续通过 status 接口查询进度
    4. 完成后获取交互式网站内容
    """
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只支持 PDF 文件")

    try:
        async with get_maic_ui_client() as client:
            # 读取文件内容
            file_content = await file.read()

            # 发送到 MAIC-UI，使用服务账户认证
            response = await client.post(
                "/api/pdf/upload",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"},
                files={"file": (file.filename, file_content, "application/pdf")},
                data={
                    "title": title,
                    "grade_level": grade_level or "",
                    "generation_mode": generation_mode,
                }
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "MAIC-UI 上传失败")
                )

            result = response.json()
            logger.info(f"PDF 上传到 MAIC-UI 成功: document_id={result.get('id')}")

            return {
                "document_id": result.get("id"),
                "status": result.get("status"),
                "title": result.get("title"),
                "filename": result.get("original_filename"),
                "message": "PDF 正在处理，请使用 status 接口查询进度"
            }

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.post("/ppt/upload")
async def upload_ppt_to_maic_ui(
    file: UploadFile = File(...),
    title: str = Form(...),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    上传 PPT 到 MAIC-UI 进行处理

    用于课程演示文稿上传场景：
    - PPT 幻灯片 → 交互式演示
    - 添加 AI 生成的演示内容
    """
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    filename = file.filename or ""
    if not (filename.lower().endswith('.ppt') or filename.lower().endswith('.pptx')):
        raise HTTPException(status_code=400, detail="只支持 PPT/PPTX 文件")

    try:
        async with get_maic_ui_client() as client:
            file_content = await file.read()

            response = await client.post(
                "/api/ppt/upload",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"},
                files={"file": (filename, file_content, file.content_type or "application/vnd.ms-powerpoint")},
                data={"title": title}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.json().get("detail", "MAIC-UI 上传失败")
                )

            result = response.json()
            logger.info(f"PPT 上传到 MAIC-UI 成功: document_id={result.get('id')}")

            return {
                "document_id": result.get("id"),
                "status": result.get("status"),
                "title": result.get("title"),
                "slide_count": result.get("slide_count"),
                "message": "PPT 正在处理"
            }

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.get("/templates")
async def get_maic_ui_templates(
    current_user_id: str = Depends(get_current_user_id)
):
    """获取 MAIC-UI 模板列表"""
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    try:
        async with get_maic_ui_client() as client:
            response = await call_maic_ui_with_retry(
                client, "GET",
                "/api/templates",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"}
            )
            return response.json()

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.post("/search-templates")
async def search_templates_for_concept(
    body: TemplateSearchRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    根据概念搜索匹配的模板

    参数：
    - concept: 概念描述
    - limit: 返回数量限制（默认 5，最大 20）
    """
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    try:
        async with get_maic_ui_client() as client:
            response = await call_maic_ui_with_retry(
                client, "POST",
                "/api/pdf/concept/search-templates",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"},
                json={"concept": body.concept, "limit": body.limit}
            )
            return response.json()

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")


@router.post("/generate-with-template")
async def generate_content_with_template(
    body: GenerateWithTemplateRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    使用模板生成内容

    参数：
    - concept: 概念描述
    - template_id: 模板 ID
    """
    if not settings.MAIC_UI_ENABLED:
        raise HTTPException(status_code=503, detail="MAIC-UI 集成未启用")

    MAIC_UI_SERVICE_TOKEN = get_service_token()
    if not MAIC_UI_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="MAIC-UI 服务令牌未配置")

    # Pydantic model already validates that concept and template_id are required

    try:
        async with get_maic_ui_client() as client:
            response = await call_maic_ui_with_retry(
                client, "POST",
                "/api/pdf/concept/generate-with-template",
                headers={"Authorization": f"Bearer {MAIC_UI_SERVICE_TOKEN}"},
                json={"concept": body.concept, "template_id": body.template_id}
            )
            return response.json()

    except httpx.RequestError as e:
        logger.error(f"MAIC-UI 请求错误: {e}")
        raise HTTPException(status_code=503, detail=f"MAIC-UI 服务连接失败: {str(e)}")