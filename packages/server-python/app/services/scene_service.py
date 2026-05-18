"""
场景创建服务 - 处理课程场景的生成和存储
"""

import asyncio
import uuid
import json
import logging
import time
import re
from typing import Dict, List, Optional, Any
from app.core.config import settings
from app.core.time_utils import utcnow
from app.services.tts_service import generate_tts, encode_audio_base64
from app.services.generation.scene_generator import generate_scene_content, fix_element_format, generate_scene_actions
from app.services.generation.outline_generator import SceneOutline

logger = logging.getLogger(__name__)


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
    构建幻灯片内容结构

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
    content = {
        "type": scene_type,
        "canvas": {
            "width": canvas_width,
            "height": canvas_height,
            "background": "#ffffff",
            "elements": [
                {
                    "id": "title",
                    "type": "text",
                    "content": scene_title,
                    "position": {"left": 50, "top": 30, "width": 900, "height": 60},
                    "style": {"fontSize": 36, "fontWeight": "bold", "color": "#333333"}
                },
                {
                    "id": "desc",
                    "type": "text",
                    "content": scene_desc,
                    "position": {"left": 50, "top": 100, "width": 900, "height": 80},
                    "style": {"fontSize": 18, "color": "#666666"}
                }
            ]
        }
    }

    # 添加要点元素（最多5个）
    for j, point in enumerate(key_points[:5]):
        content["canvas"]["elements"].append({
            "id": f"point_{j}",
            "type": "text",
            "content": f"• {point}",
            "position": {"left": 50, "top": 200 + j * 50, "width": 900, "height": 40},
            "style": {"fontSize": 16, "color": "#444444"}
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
    )

    logger.info(f"[Scene] #{order_index}: 开始生成 - {scene_title}, agents={len(agents) if agents else 0}")

    # 生成内容（第一阶段）
    try:
        logger.info(f"[Scene] #{order_index}: 开始调用LLM生成内容 - model={settings.DEFAULT_MODEL}")
        content = await generate_scene_content(
            outline_obj,
            language=language,
            model=settings.DEFAULT_MODEL,
            agents=agents,
        )
        # 格式标准化：确保 elements 在 canvas 中
        if "elements" in content and "canvas" not in content:
            content = {"type": "slide", "canvas": {"width": 1000, "height": 562.5, "background": {"color": "#ffffff"}, "elements": content["elements"]}}
        elif "canvas" in content and "elements" not in content["canvas"] and "elements" in content:
            content["canvas"]["elements"] = content.pop("elements")
        logger.info(f"[Scene] #{order_index}: 内容生成成功 - elements={len(content.get('canvas', {}).get('elements', []))}")
    except asyncio.TimeoutError as e:
        logger.warning(f"[Scene] #{order_index}: 内容生成超时，使用fallback")
        fallback_content = build_slide_content(scene_type, scene_title, scene_desc, key_points)
        content = fix_element_format(fallback_content)
    except Exception as e:
        logger.warning(f"[Scene] #{order_index}: 内容生成失败 - {type(e).__name__}: {e}")
        fallback_content = build_slide_content(scene_type, scene_title, scene_desc, key_points)
        content = fix_element_format(fallback_content)

    # 生成动作（第二阶段）- 使用实际内容
    try:
        logger.info(f"[Scene] #{order_index}: 开始调用LLM生成动作")
        actions = await generate_scene_actions(
            outline_obj,
            content,
            language=language,
            model=settings.DEFAULT_MODEL,
            agents=agents,
        )
        actions_data = [a.model_dump() for a in actions]
        logger.info(f"[Scene] #{order_index}: Actions生成成功 ({len(actions_data)}个)")
    except asyncio.TimeoutError as e:
        logger.warning(f"[Scene] #{order_index}: 动作生成超时，使用fallback")
        actions_data = await generate_scene_actions_with_tts(
            scene_title, scene_desc, key_points, language, content
        )
    except Exception as e:
        logger.warning(f"[Scene] #{order_index}: 动作生成失败 - {type(e).__name__}: {e}")
        actions_data = await generate_scene_actions_with_tts(
            scene_title, scene_desc, key_points, language, content
        )

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

    content_json = json.dumps({"type": "slide", "canvas": {"elements": []}})
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
        "content": {"type": "slide", "canvas": {"elements": []}},
        "actions": [],
    }


async def create_stage_record(
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    name: str,
    description: Optional[str],
    language: str,
    agent_ids: List[str],
    tags: List[str] = [],
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
        agent_ids: 智能体 ID 列表
        tags: 课程标签列表
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
    tags_json = json.dumps(tags) if tags is not None else '[]'

    await db.execute(
        """
        INSERT INTO stages (id, user_id, name, description, language_directive, style, agent_ids, tags, created_at, updated_at, generated_agent_configs, pending_outlines)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """,
        stage_id,
        user_uuid,
        name,
        description,
        language,
        None,
        agent_ids_json,
        tags_json,
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
) -> List[Dict[str, Any]]:
    """
    批量创建所有场景

    Args:
        outlines: 大纲列表
        stage_id: 课程 ID
        user_uuid: 用户 UUID
        db: 数据库连接
        language: 语言设置

    Returns:
        场景列表
    """
    scenes = []

    for i, outline in enumerate(outlines):
        try:
            scene = await create_single_scene(
                outline=outline,
                stage_id=stage_id,
                user_uuid=user_uuid,
                order_index=i + 1,
                db=db,
                language=language,
            )
            scenes.append(scene)
        except Exception as e:
            logger.warning(f"[Scene] #{i+1} 创建失败: {e}")
            # 创建降级场景
            fallback_scene = await create_fallback_scene(
                outline=outline,
                stage_id=stage_id,
                user_uuid=user_uuid,
                order_index=i + 1,
                db=db
            )
            scenes.append(fallback_scene)

    return scenes