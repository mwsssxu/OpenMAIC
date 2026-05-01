"""
场景创建服务 - 处理课程场景的生成和存储
"""

import uuid
import json
import logging
import time
from typing import Dict, List, Optional, Any
from app.core.config import settings
from app.core.time_utils import utcnow
from app.services.tts_service import generate_tts, encode_audio_base64

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
    language: str = "zh-CN",
) -> List[Dict[str, Any]]:
    """
    生成场景讲解动作（仅包含文本，音频由客户端按需生成）

    Args:
        scene_title: 场景标题
        scene_desc: 场景描述
        language: 语言设置

    Returns:
        Actions 列表（speech action，不含预生成的音频）
    """
    # 根据语言生成讲解文本
    if language == "en-US":
        speech_text = f"Now let's learn about {scene_title}. {scene_desc}"
    elif language == "ja-JP":
        speech_text = f"{scene_title}について学びましょう。{scene_desc}"
    else:
        speech_text = f"现在我们来学习{scene_title}。{scene_desc}"

    # 文本长度检查
    if len(speech_text) > MAX_TTS_TEXT_LENGTH:
        speech_text = speech_text[:MAX_TTS_TEXT_LENGTH]
        logger.warning(f"[TTS] Text truncated to {MAX_TTS_TEXT_LENGTH} characters")

    action_id = str(uuid.uuid4())

    # 只存储文本，不预生成音频（客户端按需请求 TTS API）
    action_data = {
        "id": action_id,
        "type": "speech",
        "data": {"text": speech_text}
    }

    return [action_data]


async def create_single_scene(
    outline: Dict[str, Any],
    stage_id: uuid.UUID,
    user_uuid: uuid.UUID,
    order_index: int,
    db: Any,
    language: str = "zh-CN",
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

    # 构建内容
    content = build_slide_content(scene_type, scene_title, scene_desc, key_points)

    # 生成讲解动作（仅文本，不预生成音频）
    actions = await generate_scene_actions_with_tts(
        scene_title, scene_desc, language
    )

    # 存储到数据库
    content_json = json.dumps(content)
    actions_json = json.dumps(actions)

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
        "actions": actions,
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
    db: Any,
    generated_agent_configs: Optional[List[Dict[str, Any]]] = None
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
        db: 数据库连接
        generated_agent_configs: 生成的智能体配置列表
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
            # 验证role类型
            if agent['role'] not in valid_roles:
                logger.error(f"[Stage] Agent #{i} invalid role: {agent['role']}")
                raise ValueError(f"Agent role must be one of {valid_roles}, got: {agent['role']}")

        logger.info(f"[Stage] Agent configs validated successfully, first agent: {generated_agent_configs[0].get('name', 'unknown')}")
    else:
        logger.info(f"[Stage] No agent configs provided (generated_agent_configs is None or empty)")

    agent_ids_json = json.dumps(agent_ids) if agent_ids else None
    agent_configs_json = json.dumps(generated_agent_configs) if generated_agent_configs else None

    await db.execute(
        """
        INSERT INTO stages (id, user_id, name, description, language_directive, style, agent_ids, created_at, updated_at, generated_agent_configs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        agent_configs_json
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