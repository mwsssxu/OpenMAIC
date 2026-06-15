"""
场景创建服务 - 处理课程场景的生成和存储
"""

import asyncio
import uuid
import json
import hashlib
import logging
import time
import re
from typing import Dict, List, Optional, Any
from app.core.config import settings
from app.core.time_utils import utcnow
from app.core.redis import get_redis
from app.services.tts_service import generate_tts, encode_audio_base64
from app.services.generation.scene_generator import generate_scene_content, fix_element_format, generate_scene_actions, _ensure_visual_shapes
from app.services.generation.outline_generator import SceneOutline

logger = logging.getLogger(__name__)


async def _publish_scene_progress(
    stage_id: uuid.UUID, completed: int, total: int, title: str, status: str
) -> None:
    """通过 Redis PUBLISH 推送场景创建进度，供 SSE 端点实时消费"""
    try:
        r = get_redis()
        if r:
            channel = f"scene_progress:{stage_id}"
            payload = json.dumps({
                "completed": completed,
                "total": total,
                "title": title,
                "status": status,
            })
            await r.publish(channel, payload)
    except Exception as e:
        # 进度推送失败不应影响场景创建主流程
        logger.debug(f"[Scene] 进度推送失败: {e}")


# 场景类型对应的 key_points 模板配置
KEY_POINTS_TEMPLATES = {
    "quiz": ["基础测试", "进阶挑战", "学习效果评估"],
    "interactive": ["互动讨论", "案例分析", "答疑解惑"],
    "pbl": ["项目任务", "实践操作", "成果展示"],
    "slide": ["概述", "核心内容", "要点总结"],
}

# 支持的语言白名单
SUPPORTED_LANGUAGES = ["zh-CN", "en-US", "ja-JP", "ko-KR"]

# 场景类型白名单
SUPPORTED_SCENE_TYPES = ["slide", "quiz", "interactive", "pbl"]

# TTS 文本长度限制
MAX_TTS_TEXT_LENGTH = 4000

# 单次请求最大场景数
MAX_SCENES_PER_REQUEST = 20


def validate_language(language: str) -> str:
    """验证语言参数"""
    if language not in SUPPORTED_LANGUAGES:
        # 默认使用中文
        return "zh-CN"
    return language


def validate_scene_type(scene_type: str) -> str:
    """验证场景类型"""
    if scene_type not in SUPPORTED_SCENE_TYPES:
        return "slide"
    return scene_type


def validate_scene_count(count: int) -> int:
    """验证场景数量"""
    if count < 1:
        return 1
    if count > MAX_SCENES_PER_REQUEST:
        return MAX_SCENES_PER_REQUEST
    return count


def generate_key_points(scene_type: str, base_topic: str, language: str = "zh-CN") -> List[str]:
    """
    根据场景类型生成 key_points

    Args:
        scene_type: 场景类型 (slide, quiz, interactive, pbl)
        base_topic: 主题名称
        language: 语言设置

    Returns:
        key_points 列表
    """
    template = KEY_POINTS_TEMPLATES.get(scene_type, KEY_POINTS_TEMPLATES["slide"])

    # 根据语言调整模板
    if language == "en-US":
        en_templates = {
            "quiz": ["Basic Test", "Advanced Challenge", "Learning Assessment"],
            "interactive": ["Interactive Discussion", "Case Analysis", "Q&A Session"],
            "pbl": ["Project Task", "Practical Operation", "Results Presentation"],
            "slide": ["Overview", "Core Content", "Key Takeaways"],
        }
        template = en_templates.get(scene_type, en_templates["slide"])

    # 结合主题生成具体要点
    return [f"{base_topic}{point}" if language == "zh-CN" else f"{base_topic} {point}"
            for point in template]


def build_slide_content(
    scene_type: str,
    scene_title: str,
    scene_desc: str,
    key_points: List[str],
    canvas_width: int = 1000,
    canvas_height: int = 562
) -> Dict[str, Any]:
    """
    构建幻灯片内容结构（fallback用，包含基础装饰shape）
    
    Args:
        scene_type: 场景类型
        scene_title: 场景标题
        scene_desc: 场景描述
        key_points: 要点列表
        canvas_width: 画布宽度
        canvas_height: 画布高度
    
    Returns:
        内容字典
    """
    # 根据标题hash选色，保持同一课程内一致
    accent_colors = ["#4472C4", "#ED7D31", "#70AD47", "#FFC000", "#5B9BD5"]
    color_idx = int(hashlib.md5(scene_title.encode()).hexdigest()[:8], 16) % len(accent_colors)
    accent_color = accent_colors[color_idx]
    
    content = {
        "type": scene_type,
        "canvas": {
            "width": canvas_width,
            "height": canvas_height,
            "background": "#ffffff",
            "elements": [
                # 装饰色条（标题左侧）
                {
                    "id": "accent_bar",
                    "type": "shape",
                    "left": 30,
                    "top": 30,
                    "width": 5,
                    "height": 60,
                    "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
                    "viewBox": [1, 1],
                    "fill": accent_color,
                    "fixedRatio": False,
                },
                # 标题下方分隔线
                {
                    "id": "divider",
                    "type": "shape",
                    "left": 30,
                    "top": 102,
                    "width": canvas_width - 60,
                    "height": 2,
                    "path": "M 0 0 L 1 0 L 1 1 L 0 1 Z",
                    "viewBox": [1, 1],
                    "fill": accent_color,
                    "fixedRatio": False,
                },
                {
                    "id": "title",
                    "type": "text",
                    "content": f'<p style="font-size: 36px; color: #333333;">{scene_title}</p>',
                    "left": 50,
                    "top": 30,
                    "width": 900,
                    "height": 60,
                    "defaultColor": "#333333",
                },
                {
                    "id": "desc",
                    "type": "text",
                    "content": f'<p style="font-size: 18px; color: #666666;">{scene_desc}</p>',
                    "left": 50,
                    "top": 100,
                    "width": 900,
                    "height": 80,
                    "defaultColor": "#666666",
                }
            ]
        }
    }

    # 添加要点元素（最多5个）
    # 每个要点前加序号图标，移动端可解析为独立图标
    point_icons = ["1", "2", "3", "4", "5"]
    for j, point in enumerate(key_points[:5]):
        content["canvas"]["elements"].append({
            "id": f"point_{j}",
            "type": "text",
            "content": f'<p style="font-size: 16px; color: #444444;">{point_icons[j]}. {point}</p>',
            "left": 50,
            "top": 200 + j * 55,
            "width": 900,
            "height": 42,
            "defaultColor": "#444444",
        })

    return content


async def generate_scene_actions_with_tts(
    scene_title: str,
    scene_desc: str,
    key_points: List[str] = [],
    language: str = "zh-CN",
    content: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    生成场景讲解动作（fallback，生成完整讲解内容）

    Args:
        scene_title: 场景标题
        scene_desc: 场景描述
        key_points: 关键要点列表（用于生成丰富讲解）
        language: 语言设置
        content: 场景内容（用于提取元素文本和生成讲解）

    Returns:
        Actions 列表（speech actions + spotlight）
    """
    import re
    actions = []

    # 1. 标题介绍（使用描述扩展）
    intro_text = f"现在我们来学习{scene_title}。{scene_desc}" if language == "zh-CN" else f"Now let's learn about {scene_title}. {scene_desc}"
    actions.append({
        "id": str(uuid.uuid4()),
        "type": "speech",
        "data": {"text": intro_text}
    })

    # 2. 使用 key_points 生成详细讲解（优先级高于 canvas 元素）
    if key_points and len(key_points) > 0:
        for i, point in enumerate(key_points[:5]):
            # 清理要点文本（去掉 bullet 符号）
            clean_point = point.lstrip("• ").strip()

            # 生成扩展讲解（比单纯朗读更丰富）
            explain_text = f"第{i+1}个要点：{clean_point}。这是本节课程的核心内容之一，请重点关注。" if language == "zh-CN" else f"Point {i+1}: {clean_point}. This is a key concept in this lesson."

            actions.append({
                "id": str(uuid.uuid4()),
                "type": "speech",
                "data": {"text": explain_text}
            })

            # 添加聚焦效果
            actions.append({
                "id": str(uuid.uuid4()),
                "type": "spotlight",
                "data": {
                    "target_element_id": f"point_{i}",
                    "dim_opacity": 0.7
                }
            })

    # 3. 从 content canvas 中提取其他文本元素补充讲解
    elif content and content.get("canvas", {}).get("elements"):
        elements = content["canvas"]["elements"]

        for el in elements[:5]:  # 最多处理5个元素
            if el.get("type") == "text" and el.get("content"):
                # 跳过标题和描述（已经讲解过）
                el_id = el.get("id", "")
                if el_id in ["title", "desc"]:
                    continue

                # 清理HTML标签
                text_content = el.get("content", "")
                if "<p" in text_content or "<" in text_content:
                    text_content = re.sub(r"<[^>]+>", "", text_content).strip()

                if text_content and len(text_content) > 5:
                    # 添加讲解
                    explain_text = f"接下来看这个要点：{text_content}" if language == "zh-CN" else f"Let's look at this point: {text_content}"
                    actions.append({
                        "id": str(uuid.uuid4()),
                        "type": "speech",
                        "data": {"text": explain_text}
                    })

                    # 添加聚焦效果（使用元素ID）
                    actions.append({
                        "id": str(uuid.uuid4()),
                        "type": "spotlight",
                        "data": {
                            "target_element_id": el.get("id"),
                            "dim_opacity": 0.7
                        }
                    })

    logger.info(f"[Scene] Fallback生成 {len(actions)} 个actions")
    return actions


async def create_single_scene(
    outline: Dict[str, Any],
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    order_index: int,
    db: Any,
    language: str = "zh-CN",
    agents: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    创建单个场景

    Args:
        outline: 场景大纲
        stage_id: 课程 ID
        user_uuid: 用户 UUID
        order_index: 场景顺序
        db: 数据库连接
        language: 语言设置
        agents: 智能体信息列表（用于构建teacherContext）

    Returns:
        场景数据字典
    """
    scene_start = time.time()
    scene_id = uuid.uuid4()

    # 提取并验证参数
    scene_type = validate_scene_type(outline.get("type", "slide"))
    scene_title = outline.get("title", f"场景 {order_index}")
    scene_desc = outline.get("description", "")
    key_points = outline.get("key_points", [])

    # 如果没有 key_points，根据标题生成
    if not key_points:
        base_topic = scene_title.replace("课程", "").replace("学习", "").strip()
        key_points = generate_key_points(scene_type, base_topic, language)

    # 构建 SceneOutline 对象
    outline_obj = SceneOutline(
        id=str(uuid.uuid4()),
        type=scene_type,
        title=scene_title,
        description=scene_desc,
        key_points=key_points,
        order=order_index,
        widget_type=outline.get("widgetType") or outline.get("widget_type"),
        widget_outline=outline.get("widgetOutline") or outline.get("widget_outline"),
    )

    logger.info(f"[Scene] #{order_index}: 开始生成 - {scene_title}, agents={len(agents) if agents else 0}")

    # 并行策略：content生成 + fallback actions生成 同时进行
    # fallback actions 不依赖 content，可并行执行
    content_task = asyncio.create_task(
        generate_scene_content(
            outline_obj,
            language=language,
            language_directive=getattr(outline_obj, 'language_directive', None),
            model=settings.DEFAULT_MODEL,
            agents=agents,
        )
    )

    # 对于 interactive/pbl 类型，actions 不依赖 content 中的元素 ID，
    # 可以与 content 并行生成，节省串行等待时间
    can_parallel_actions = scene_type in ("interactive", "pbl")
    precise_actions_task = None
    if can_parallel_actions:
        # 构造占位 content（interactive/pbl actions 只用 outline 信息）
        placeholder_content = {"type": scene_type}
        precise_actions_task = asyncio.create_task(
            generate_scene_actions(
                outline_obj,
                placeholder_content,
                language=language,
                model=settings.DEFAULT_MODEL,
                agents=agents,
            )
        )

    # 并行启动 fallback actions 生成（使用 outline 信息，不依赖 content）
    fallback_actions_task = asyncio.create_task(
        generate_scene_actions_with_tts(
            scene_title, scene_desc, key_points, language, None  # content=None，仅使用 outline
        )
    )

    # 等待 content 完成
    content = None
    content_success = False
    try:
        logger.info(f"[Scene] #{order_index}: 等待内容生成...")
        content = await content_task
        content_time = time.time() - scene_start
        logger.info(f"[Scene] #{order_index}: 内容生成耗时 {content_time:.2f}s")
        # 格式标准化：确保 elements 在 canvas 中
        if "elements" in content and "canvas" not in content:
            content = {"type": "slide", "canvas": {"width": 1000, "height": 562.5, "background": {"color": "#ffffff"}, "elements": content["elements"]}}
        elif "canvas" in content and "elements" not in content["canvas"] and "elements" in content:
            content["canvas"]["elements"] = content.pop("elements")
        content_success = True
        logger.info(f"[Scene] #{order_index}: 内容生成成功 - elements={len(content.get('canvas', {}).get('elements', []))}")
    except asyncio.TimeoutError as e:
        logger.warning(f"[Scene] #{order_index}: 内容生成超时，使用fallback")
        fallback_content = build_slide_content(scene_type, scene_title, scene_desc, key_points)
        content = _ensure_visual_shapes(fix_element_format(fallback_content))
    except Exception as e:
        logger.warning(f"[Scene] #{order_index}: 内容生成失败 - {type(e).__name__}: {e}")
        fallback_content = build_slide_content(scene_type, scene_title, scene_desc, key_points)
        content = _ensure_visual_shapes(fix_element_format(fallback_content))

    # 获取 fallback actions 结果（此时应该已完成或接近完成）
    fallback_actions = None
    try:
        # fallback actions 应该很快完成（不调用 LLM）
        fallback_actions = await fallback_actions_task
        logger.info(f"[Scene] #{order_index}: Fallback actions 就绪 ({len(fallback_actions)}个)")
    except Exception as e:
        logger.warning(f"[Scene] #{order_index}: Fallback actions 失败: {e}")
        fallback_actions = []

    # 如果 content 成功，尝试获取/生成精确 actions
    # 失败时直接使用 fallback，不再重复调用 generate_scene_actions_with_tts
    actions_start = time.time()
    actions_data = fallback_actions
    if precise_actions_task is not None:
        # interactive/pbl: actions 已在并行生成，直接等结果
        try:
            logger.info(f"[Scene] #{order_index}: 等待并行 actions 结果...")
            actions = await precise_actions_task
            actions_data = [a.model_dump() for a in actions]
            actions_time = time.time() - actions_start
            logger.info(f"[Scene] #{order_index}: 并行 actions 成功 ({len(actions_data)}个, 耗时 {actions_time:.2f}s)")
        except Exception as e:
            logger.warning(f"[Scene] #{order_index}: 并行 actions 失败，使用 fallback ({type(e).__name__})")
    elif content_success and content:
        try:
            logger.info(f"[Scene] #{order_index}: 尝试生成精确 actions...")
            actions = await generate_scene_actions(
                outline_obj,
                content,
                language=language,
                model=settings.DEFAULT_MODEL,
                agents=agents,
            )
            actions_data = [a.model_dump() for a in actions]
            actions_time = time.time() - actions_start
            logger.info(f"[Scene] #{order_index}: 精确 actions 成功 ({len(actions_data)}个, 耗时 {actions_time:.2f}s)")
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"[Scene] #{order_index}: 精确 actions 失败，使用 fallback ({type(e).__name__})")

    # 存储到数据库
    content_json = json.dumps(content)
    actions_json = json.dumps(actions_data)

    await db.execute(
        """
        INSERT INTO scenes (id, stage_id, user_id, type, title, order_index, content, actions, whiteboards)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        scene_id,
        stage_id,
        user_uuid,
        scene_type,
        scene_title,
        order_index,
        content_json,
        actions_json,
        None
    )

    scene_elapsed = time.time() - scene_start
    logger.info(f"[Scene] #{order_index}: {scene_title} (耗时: {scene_elapsed:.2f}s)")

    return {
        "id": str(scene_id),
        "type": scene_type,
        "title": scene_title,
        "order_index": order_index,
        "content": content,
        "actions": actions_data,
    }


async def create_fallback_scene(
    outline: Dict[str, Any],
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    order_index: int,
    db: Any
) -> Dict[str, Any]:
    """
    创建失败降级场景（当正常创建失败时使用）

    Args:
        outline: 场景大纲
        stage_id: 课程 ID
        user_uuid: 用户 UUID
        order_index: 场景顺序
        db: 数据库连接

    Returns:
        场景数据字典
    """
    scene_id = uuid.uuid4()
    scene_type = validate_scene_type(outline.get("type", "slide"))
    scene_title = outline.get("title", f"场景 {order_index}")

    # 根据场景类型生成适当的 fallback 内容
    if scene_type == "interactive":
        # 保留 interactive 类型，提供最小可用内容（含 widgetType 标记）
        widget_type = outline.get("widgetType") or outline.get("widget_type") or "simulation"
        content = {
            "type": "interactive",
            "widgetType": widget_type,
            "html": f"<div style='padding:20px;text-align:center'><h3>{outline.get('title', '互动场景')}</h3><p>互动内容正在准备中</p></div>",
            "description": outline.get("description", ""),
            "key_points": outline.get("key_points", outline.get("keyPoints", [])),
        }
        content_json = json.dumps(content)
    elif scene_type == "quiz":
        content = {"type": "quiz", "questions": []}
        content_json = json.dumps(content)
    elif scene_type == "pbl":
        content = {"type": "pbl", "description": outline.get("description", ""), "steps": []}
        content_json = json.dumps(content)
    else:
        content = {"type": "slide", "canvas": {"elements": []}}
        content_json = json.dumps(content)
    actions_json = json.dumps([])

    await db.execute(
        """
        INSERT INTO scenes (id, stage_id, user_id, type, title, order_index, content, actions, whiteboards)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        scene_id,
        stage_id,
        user_uuid,
        scene_type,
        scene_title,
        order_index,
        content_json,
        actions_json,
        None
    )

    return {
        "id": str(scene_id),
        "type": scene_type,
        "title": scene_title,
        "order_index": order_index,
        "content": content,
        "actions": [],
    }


async def create_stage_record(
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    name: str,
    description: Optional[str],
    language: str,
    agent_ids: List[str],
    db: Any,
    generated_agent_configs: Optional[List[Dict[str, Any]]] = None,
    pending_outlines: Optional[List[Dict[str, Any]]] = None
) -> None:
    """
    创建课程记录

    Args:
        stage_id: 课程 ID
        user_uuid: 用户 UUID
        name: 课程名称
        description: 课程描述
        language: 语言设置
        agent_ids: 能体 ID 列表
        db: 数据库连接
        generated_agent_configs: 生成的智能体配置列表
        pending_outlines: 待创建的场景大纲列表
    """
    now = utcnow()

    # 验证智能体配置结构（如果提供）
    if generated_agent_configs:
        logger.info(f"[Stage] Validating {len(generated_agent_configs)} agent configs")
        # 限制数量（最多10个）
        if len(generated_agent_configs) > 10:
            logger.warning(f"[Stage] Agent configs truncated to 10 (was {len(generated_agent_configs)})")
            generated_agent_configs = generated_agent_configs[:10]

        # 验证每个智能体的必需字段
        required_fields = ['id', 'name', 'role']
        valid_roles = ['teacher', 'assistant', 'student']
        for i, agent in enumerate(generated_agent_configs):
            # 检查必需字段
            missing = [f for f in required_fields if f not in agent or not agent[f]]
            if missing:
                logger.error(f"[Stage] Agent #{i} missing required fields: {missing}, agent data: {agent}")
                raise ValueError(f"Agent config missing required fields: {missing}")
            # 验证role类型（大小写不敏感）
            role_lower = agent['role'].lower()
            if role_lower not in valid_roles:
                logger.error(f"[Stage] Agent #{i} invalid role: {agent['role']}")
                raise ValueError(f"Agent role must be one of {valid_roles}, got: {agent['role']}")
            # 标准化role为小写
            agent['role'] = role_lower

        logger.info(f"[Stage] Agent configs validated successfully, first agent: {generated_agent_configs[0].get('name', 'unknown')}")
    else:
        logger.info(f"[Stage] No agent configs provided (generated_agent_configs is None or empty)")

    # 保存大纲数据（用于后续场景创建）
    if pending_outlines:
        logger.info(f"[Stage] Saving {len(pending_outlines)} pending outlines for later scene creation")

    agent_ids_json = json.dumps(agent_ids) if agent_ids is not None else None
    agent_configs_json = json.dumps(generated_agent_configs) if generated_agent_configs is not None else None
    pending_outlines_json = json.dumps(pending_outlines) if pending_outlines is not None else None

    await db.execute(
        """
        INSERT INTO stages (id, user_id, name, description, language_directive, style, agent_ids, created_at, updated_at, generated_agent_configs, pending_outlines)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """,
        stage_id,
        user_uuid,
        name,
        description,
        language,
        None,
        agent_ids_json,
        now,
        now,
        agent_configs_json,
        pending_outlines_json
    )


async def create_all_scenes(
    outlines: List[Dict[str, Any]],
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    db: Any,
    language: str = "zh-CN",
    max_concurrent: int = 4,
    start_order_index: int = 0,
    agents: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    批量创建所有场景（并行执行，带并发控制）

    Args:
        outlines: 大纲列表
        stage_id: 课程 ID
        user_uuid: 用户 UUID
        db: 数据库连接
        language: 语言设置
        max_concurrent: 最大并发数（默认3，避免API限流）
        start_order_index: 已有场景数（追加场景时 order_index 从此值之后开始）
        agents: 智能体信息列表（用于构建teacherContext和actions生成）

    Returns:
        场景列表
    """
    if not outlines:
        return []

    total = len(outlines)
    logger.info(f"[Scene] 开始并行创建 {total} 个场景，并发数={max_concurrent}")

    # 使用 Semaphore 控制并发数
    semaphore = asyncio.Semaphore(max_concurrent)

    async def create_scene_with_semaphore(index: int, outline: Dict[str, Any]) -> Dict[str, Any]:
        """带并发控制的场景创建"""
        async with semaphore:
            try:
                logger.info(f"[Scene] #{index + 1}/{total} 开始创建...")
                scene = await create_single_scene(
                    outline=outline,
                    stage_id=stage_id,
                    user_uuid=user_uuid,
                    order_index=start_order_index + index + 1,
                    db=db,
                    language=language,
                    agents=agents,
                )
                logger.info(f"[Scene] #{index + 1}/{total} 创建成功")
                # 推送场景创建进度到 Redis
                await _publish_scene_progress(stage_id, index + 1, total, scene.get("title", ""), "completed")
                return scene
            except Exception as e:
                logger.warning(f"[Scene] #{index + 1}/{total} 创建失败: {e}")
                # 创建降级场景
                fallback_scene = await create_fallback_scene(
                    outline=outline,
                    stage_id=stage_id,
                    user_uuid=user_uuid,
                    order_index=start_order_index + index + 1,
                    db=db
                )
                logger.info(f"[Scene] #{index + 1}/{total} 使用降级场景")
                # 推送降级场景进度
                await _publish_scene_progress(stage_id, index + 1, total, fallback_scene.get("title", ""), "fallback")
                return fallback_scene

    # 并行创建所有场景
    start_time = time.time()
    tasks = [
        create_scene_with_semaphore(i, outline)
        for i, outline in enumerate(outlines)
    ]

    # 使用 gather 并行执行，return_exceptions=True 确保单场景失败不影响整体
    results = await asyncio.gather(*tasks, return_exceptions=True)

    scenes = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"[Scene] #{i + 1} 异常: {result}")
            # 异常时创建降级场景
            fallback = await create_fallback_scene(
                outline=outlines[i],
                stage_id=stage_id,
                user_uuid=user_uuid,
                order_index=start_order_index + i + 1,
                db=db
            )
            scenes.append(fallback)
            # 推送 gather 异常降级场景进度
            await _publish_scene_progress(stage_id, i + 1, total, fallback.get("title", ""), "fallback")
        else:
            scenes.append(result)

    elapsed = time.time() - start_time
    logger.info(f"[Scene] 全部 {total} 个场景创建完成，总耗时: {elapsed:.2f}s")

    return scenes