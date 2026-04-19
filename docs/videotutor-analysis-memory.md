"""
长期记忆系统 - 借鉴 VideoTutor 的学习记忆功能
追踪学生学习轨迹，实现自适应教学

VideoTutor 功能模块：
├── Capture Session - 捕获学习会话
├── Extract Signals - 提取学习信号（理解程度、兴趣点、困惑点）
├── Update Memory - 更新记忆状态
├── Assemble Context - 智能组装上下文
├── Adapt Teaching - 自适应教学调整
└── Long-term Memory - 长期记忆存储

实现方案：
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import uuid


# ============ 数据模型 ============

class LearningSignal(BaseModel):
    """学习信号（从交互中提取）"""
    type: str  # understanding, confusion, interest, fatigue, mastery
    confidence: float  # 0-1
    context: Dict[str, Any]  # 相关上下文
    timestamp: datetime


class LearningSession(BaseModel):
    """学习会话记录"""
    id: str
    user_id: str
    course_id: str
    scene_ids: List[str]
    duration: float  # 分钟
    signals: List[LearningSignal]
    interactions: List[Dict]  # 点击、答题、提问等
    summary: Optional[str] = None


class LearningMemory(BaseModel):
    """长期记忆"""
    user_id: str
    course_id: str
    
    # 学习进度
    completed_scenes: List[str]
    current_scene: Optional[str]
    total_time: float  # 累计学习时间
    
    # 知识掌握度
    mastery_map: Dict[str, float]  # topic_id -> mastery_level (0-1)
    
    # 学习特征
    preferred_style: str  # visual, textual, interactive
    learning_speed: str  # fast, normal, slow
    attention_spans: List[float]  # 平均专注时长
    
    # 弱点识别
    weak_points: List[str]  # 需要加强的知识点
    strong_points: List[str]  # 已掌握的知识点
    
    # 兴趣偏好
    interests: List[str]  # 感兴趣的主题
    
    # 最近学习
    last_session: Optional[datetime]
    session_count: int


# ============ 数据库表设计 ============

LEARNING_MEMORY_SCHEMA = """
-- 学习会话记录表
CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES stages(id),
    scene_ids JSONB,
    duration_minutes FLOAT,
    signals JSONB,  -- 学习信号列表
    interactions JSONB,  -- 交互记录
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 长期记忆表
CREATE TABLE learning_memories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES stages(id),
    
    -- 学习进度
    completed_scenes JSONB,
    current_scene UUID,
    total_time FLOAT DEFAULT 0,
    
    -- 知识掌握度
    mastery_map JSONB DEFAULT '{}',
    
    -- 学习特征
    preferred_style VARCHAR(20) DEFAULT 'visual',
    learning_speed VARCHAR(20) DEFAULT 'normal',
    attention_spans JSONB DEFAULT '[]',
    
    -- 弱点识别
    weak_points JSONB DEFAULT '[]',
    strong_points JSONB DEFAULT '[]',
    interests JSONB DEFAULT '[]',
    
    -- 统计
    last_session TIMESTAMP,
    session_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, course_id)
);

-- 学习信号索引（用于快速查询）
CREATE INDEX idx_learning_sessions_user ON learning_sessions(user_id);
CREATE INDEX idx_learning_memories_user_course ON learning_memories(user_id, course_id);
"""


# ============ 信号提取引擎 ============

SIGNAL_EXTRACTION_RULES = {
    # 理解信号
    "understanding": {
        "triggers": [
            {"action": "quiz_correct", "weight": 0.8},
            {"action": "ask_explanation", "weight": 0.6},
            {"action": "bookmark", "weight": 0.7},
        ],
        "indicator": "学生理解了当前内容",
    },
    
    # 困惑信号
    "confusion": {
        "triggers": [
            {"action": "quiz_wrong", "weight": 0.7},
            {"action": "pause_long", "weight": 0.5},  # 长时间暂停
            {"action": "replay", "weight": 0.6},  # 重看
            {"action": "ask_question", "weight": 0.8},
        ],
        "indicator": "学生对内容感到困惑",
    },
    
    # 兴趣信号
    "interest": {
        "triggers": [
            {"action": "expand_content", "weight": 0.8},  # 点击展开
            {"action": "stay_long", "weight": 0.7},  # 长时间停留
            {"action": "save_note", "weight": 0.9},
            {"action": "share", "weight": 1.0},
        ],
        "indicator": "学生对内容感兴趣",
    },
    
    # 疲劳信号
    "fatigue": {
        "triggers": [
            {"action": "skip_fast", "weight": 0.7},  # 快速跳过
            {"action": "session_long", "weight": 0.6},  # 长时间学习
            {"action": "idle_long", "weight": 0.8},  # 长时间无操作
        ],
        "indicator": "学生注意力下降",
    },
    
    # 掌握信号
    "mastery": {
        "triggers": [
            {"action": "quiz_correct_multiple", "weight": 0.9},
            {"action": "complete_scene", "weight": 0.8},
            {"action": "teach_others", "weight": 1.0},  # 教别人
        ],
        "indicator": "学生已掌握该知识点",
    },
}


async def extract_learning_signals(
    interactions: List[Dict],
    scene_context: Dict,
) -> List[LearningSignal]:
    """
    从用户交互中提取学习信号
    
    Args:
        interactions: 交互记录列表 [{action, timestamp, data}]
        scene_context: 当前场景上下文
    
    Returns:
        学习信号列表
    """
    signals = []
    
    for interaction in interactions:
        action = interaction.get("action")
        
        for signal_type, rules in SIGNAL_EXTRACTION_RULES.items():
            for trigger in rules["triggers"]:
                if action == trigger["action"]:
                    signals.append(LearningSignal(
                        type=signal_type,
                        confidence=trigger["weight"],
                        context={
                            "action": action,
                            "scene_id": scene_context.get("scene_id"),
                            "topic": scene_context.get("topic"),
                        },
                        timestamp=interaction.get("timestamp", datetime.now()),
                    ))
    
    return signals


# ============ 记忆更新引擎 ============

async def update_learning_memory(
    user_id: str,
    course_id: str,
    session: LearningSession,
    db,
) -> LearningMemory:
    """
    更新长期记忆
    
    Args:
        user_id: 用户ID
        course_id: 课程ID
        session: 当前学习会话
        db: 数据库连接
    
    Returns:
        更新后的记忆
    """
    from app.core.time_utils import utcnow
    
    # 获取现有记忆
    memory = await db.fetchrow(
        """
        SELECT * FROM learning_memories 
        WHERE user_id = $1 AND course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id),
    )
    
    if not memory:
        # 创建新记忆
        memory_id = await db.fetchval(
            """
            INSERT INTO learning_memories (id, user_id, course_id, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            uuid.uuid4(),
            uuid.UUID(user_id),
            uuid.UUID(course_id),
            utcnow(),
        )
        memory = {
            "completed_scenes": [],
            "mastery_map": {},
            "weak_points": [],
            "strong_points": [],
            "total_time": 0,
            "session_count": 0,
        }
    
    # 分析信号，更新记忆
    mastery_updates = {}
    weak_points = set(memory.get("weak_points", []))
    strong_points = set(memory.get("strong_points", []))
    
    for signal in session.signals:
        topic = signal.context.get("topic")
        
        if signal.type == "mastery" and topic:
            mastery_updates[topic] = min(
                (memory.get("mastery_map", {}).get(topic, 0) + 0.2),
                1.0
            )
            weak_points.discard(topic)
            strong_points.add(topic)
        
        elif signal.type == "confusion" and topic:
            mastery_updates[topic] = max(
                (memory.get("mastery_map", {}).get(topic, 0) - 0.1),
                0.0
            )
            weak_points.add(topic)
            strong_points.discard(topic)
        
        elif signal.type == "interest" and topic:
            interests = set(memory.get("interests", []))
            interests.add(topic)
            # TODO: 更新兴趣列表
    
    # 更新数据库
    new_mastery = {**memory.get("mastery_map", {}), **mastery_updates}
    
    await db.execute(
        """
        UPDATE learning_memories SET
            completed_scenes = $2,
            mastery_map = $3,
            weak_points = $4,
            strong_points = $5,
            total_time = $6,
            session_count = $7,
            last_session = $8,
            updated_at = $9
        WHERE user_id = $1 AND course_id = $10
        """,
        uuid.UUID(user_id),
        json.dumps(list(set(memory.get("completed_scenes", []) + session.scene_ids))),
        json.dumps(new_mastery),
        json.dumps(list(weak_points)),
        json.dumps(list(strong_points)),
        memory.get("total_time", 0) + session.duration,
        memory.get("session_count", 0) + 1,
        utcnow(),
        utcnow(),
        uuid.UUID(course_id),
    )
    
    return LearningMemory(
        user_id=user_id,
        course_id=course_id,
        completed_scenes=memory.get("completed_scenes", []) + session.scene_ids,
        mastery_map=new_mastery,
        weak_points=list(weak_points),
        strong_points=list(strong_points),
        total_time=memory.get("total_time", 0) + session.duration,
        session_count=memory.get("session_count", 0) + 1,
        last_session=utcnow(),
    )


# ============ 自适应教学引擎 ============

async def adapt_teaching_content(
    memory: LearningMemory,
    next_scene: Dict,
    db,
) -> Dict:
    """
    根据记忆自适应调整教学内容
    
    Args:
        memory: 学习记忆
        next_scene: 下一个场景内容
        db: 数据库连接
    
    Returns:
        调整后的场景内容
    """
    adaptations = {}
    
    # 1. 根据学习速度调整
    if memory.learning_speed == "slow":
        adaptations["narration_speed"] = "slow"
        adaptations["content_density"] = "low"
        adaptations["more_examples"] = True
    
    elif memory.learning_speed == "fast":
        adaptations["narration_speed"] = "fast"
        adaptations["content_density"] = "high"
        adaptations["skip_basic"] = True
    
    # 2. 根据弱点加强
    scene_topic = next_scene.get("title")
    if scene_topic in memory.weak_points:
        adaptations["emphasize"] = True
        adaptations["more_explanation"] = True
        adaptations["quizzes_before"] = True  # 先测验检测理解
    
    # 3. 根据兴趣偏好
    if memory.preferred_style == "visual":
        adaptations["more_images"] = True
        adaptations["less_text"] = True
    
    elif memory.preferred_style == "interactive":
        adaptations["more_interactions"] = True
        adaptations["hands_on"] = True
    
    # 4. 根据疲劳状态
    if memory.attention_spans and len(memory.attention_spans) > 3:
        avg_span = sum(memory.attention_spans[-3:]) / 3
        if avg_span < 5:  # 注意力下降
            adaptations["break_reminder"] = True
            adaptations["shorter_scenes"] = True
    
    # 应用调整到场景内容
    adapted_scene = {**next_scene, "adaptations": adaptations}
    
    return adapted_scene


# ============ 上下文组装引擎 ============

async def assemble_teaching_context(
    user_id: str,
    course_id: str,
    current_scene_id: str,
    db,
) -> Dict:
    """
    组装教学上下文（智能体讲解时使用）
    
    Args:
        user_id: 用户ID
        course_id: 课程ID
        current_scene_id: 当前场景ID
        db: 数据库连接
    
    Returns:
        教学上下文（用于智能体对话）
    """
    # 获取记忆
    memory = await db.fetchrow(
        """
        SELECT * FROM learning_memories 
        WHERE user_id = $1 AND course_id = $2
        """,
        uuid.UUID(user_id),
        uuid.UUID(course_id),
    )
    
    # 获取当前场景
    scene = await db.fetchrow(
        """
        SELECT * FROM scenes WHERE id = $1
        """,
        uuid.UUID(current_scene_id),
    )
    
    # 组装上下文
    context = {
        "current_scene": {
            "title": scene["name"],
            "position": scene["position"],
        },
        
        "user_progress": {
            "completed": memory.get("completed_scenes", []) if memory else [],
            "mastery_level": memory.get("mastery_map", {}) if memory else {},
            "total_time": memory.get("total_time", 0) if memory else 0,
        },
        
        "focus_points": {
            "weak": memory.get("weak_points", []) if memory else [],
            "interests": memory.get("interests", []) if memory else [],
        },
        
        "teaching_hints": [],
    }
    
    # 生成教学提示
    if memory:
        weak = memory.get("weak_points", [])
        if weak:
            context["teaching_hints"].append(
                f"学生对 {weak[0]} 有困惑，需要更多解释"
            )
        
        interests = memory.get("interests", [])
        if interests:
            context["teaching_hints"].append(
                f"学生对 {interests[0]} 特别感兴趣，可以深入讲解"
            )
    
    return context


# ============ API接口 ============

"""
@router.post("/sessions/record")
async def record_learning_session(
    body: dict,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db),
):
    """记录学习会话并更新记忆"""
    course_id = body.get("course_id")
    scene_ids = body.get("scene_ids", [])
    interactions = body.get("interactions", [])
    duration = body.get("duration", 0)
    
    # 1. 提取信号
    signals = await extract_learning_signals(interactions, {})
    
    # 2. 创建会话记录
    session = LearningSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        course_id=course_id,
        scene_ids=scene_ids,
        duration=duration,
        signals=signals,
        interactions=interactions,
    )
    
    await db.execute(
        """
        INSERT INTO learning_sessions (id, user_id, course_id, scene_ids, duration_minutes, signals, interactions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        ...
    )
    
    # 3. 更新记忆
    memory = await update_learning_memory(user_id, course_id, session, db)
    
    return {"session_id": session.id, "memory_updated": True}


@router.get("/memory/{course_id}")
async def get_learning_memory(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db),
):
    """获取学习记忆"""
    memory = await db.fetchrow(...)
    return {"memory": memory}


@router.get("/adapt/{scene_id}")
async def get_adapted_scene(
    scene_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db),
):
    """获取自适应调整后的场景内容"""
    memory = await get_user_memory(user_id, course_id, db)
    scene = await get_scene(scene_id, db)
    
    adapted = await adapt_teaching_content(memory, scene, db)
    
    return {"adapted_scene": adapted}
"""


# ============ 实现难度评估 ============

"""
实现难度：⭐⭐⭐ (中等)

容易实现的部分：
├── ✅ 数据库表设计 (1小时)
├── ✅ 会话记录存储 (已有基础)
├── ✅ 简单信号提取 (基于答题结果)
└── ✅ 记忆更新逻辑 (基础版)

中等难度：
├── ⚠️ 复杂信号提取 (需分析用户行为模式)
├── ⚠️ 自适应内容调整 (需LLM参与)
└── ⚠️ 上下文组装 (需整合多数据源)

较难部分：
├── ❌ 注意力检测 (需前端配合)
├── ❌ 学习风格识别 (需多会话数据)
└── ❌ 预测性调整 (需机器学习模型)

推荐实现顺序：
1. Week 1: 数据表 + 会话记录 + 基础信号
2. Week 2: 记忆更新 + 弱点识别
3. Week 3: 自适应调整 + 上下文组装
"""