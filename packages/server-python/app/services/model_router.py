"""
模型路由系统 - 根据场景类型选择合适的模型

支持:
- 文本模型 (chat)
- 多模态模型 (vision)
- TTS模型 (speech)

设计原则:
1. 场景驱动: 根据使用场景自动选择合适的模型
2. 配置灵活: 支持通过环境变量和配置文件覆盖默认值
3. 成本优化: 优先使用性价比高的模型
4. 回退机制: 主模型不可用时自动降级
"""

import logging
import os
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, field
from app.core.config import settings

logger = logging.getLogger(__name__)


class ModelCapability(Enum):
    """模型能力类型"""
    TEXT = "text"           # 文本生成
    VISION = "vision"       # 多模态（图像理解）
    IMAGE_GEN = "image_gen" # 图像生成
    TTS = "tts"            # 语音合成
    EMBEDDING = "embedding" # 文本嵌入


class SceneType(Enum):
    """使用场景类型"""
    # 文本生成场景
    OUTLINE_GENERATION = "outline_generation"      # 大纲生成
    SCENE_GENERATION = "scene_generation"         # 场景内容生成
    AGENT_CHAT = "agent_chat"                     # Agent对话
    QUIZ_GRADING = "quiz_grading"                 # 测验批改

    # 多模态场景
    INTERACTIVE_GENERATION = "interactive_generation"  # 交互式内容（可能需要图片）
    IMAGE_DESCRIPTION = "image_description"            # 图片描述
    PDF_ANALYSIS = "pdf_analysis"                      # PDF分析（可能含图片）

    # 语音场景
    TTS_SYNTHESIS = "tts_synthesis"               # 语音合成


@dataclass
class ModelConfig:
    """模型配置"""
    model_id: str
    provider: str
    api_base: str = ""
    api_key: str = ""
    max_tokens: int = 4096
    temperature: float = 0.7
    capabilities: List[ModelCapability] = field(default_factory=list)
    priority: int = 1  # 优先级，数字越小越优先
    fallback_model: Optional[str] = None  # 降级模型


@dataclass
class ProviderConfig:
    """提供商配置"""
    name: str
    api_base: str
    api_key: str
    models: Dict[str, ModelConfig] = field(default_factory=dict)


# ============ 默认模型配置 ============

DEFAULT_MODEL_CONFIGS: Dict[str, ModelConfig] = {
    # 文本模型
    "qwen3.6-plus": ModelConfig(
        model_id="qwen3.6-plus",
        provider="qwen",
        max_tokens=8192,
        temperature=0.7,
        capabilities=[ModelCapability.TEXT],
        priority=1,
    ),
    "qwen-turbo": ModelConfig(
        model_id="qwen-turbo",
        provider="qwen",
        max_tokens=4096,
        temperature=0.7,
        capabilities=[ModelCapability.TEXT],
        priority=2,
        fallback_model=os.environ.get("DEFAULT_MODEL", "qwen3.7-plus"),
    ),
    "deepseek-chat": ModelConfig(
        model_id="deepseek-chat",
        provider="deepseek",
        max_tokens=4096,
        temperature=0.7,
        capabilities=[ModelCapability.TEXT],
        priority=3,
    ),
    "gpt-4o": ModelConfig(
        model_id="gpt-4o",
        provider="openai",
        max_tokens=4096,
        temperature=0.7,
        capabilities=[ModelCapability.TEXT, ModelCapability.VISION],
        priority=4,
    ),

    # 多模态模型
    "qwen-vl-max": ModelConfig(
        model_id="qwen-vl-max",
        provider="qwen",
        max_tokens=4096,
        temperature=0.5,
        capabilities=[ModelCapability.VISION, ModelCapability.TEXT],
        priority=1,
    ),
    "qwen-vl-plus": ModelConfig(
        model_id="qwen-vl-plus",
        provider="qwen",
        max_tokens=2048,
        temperature=0.5,
        capabilities=[ModelCapability.VISION, ModelCapability.TEXT],
        priority=2,
        fallback_model="qwen-vl-max",
    ),
    "glm-4v": ModelConfig(
        model_id="glm-4v",
        provider="zhipu",
        max_tokens=4096,
        temperature=0.5,
        capabilities=[ModelCapability.VISION, ModelCapability.TEXT],
        priority=3,
        fallback_model="qwen-vl-max",
    ),

    # TTS模型
    "qwen3-tts-flash": ModelConfig(
        model_id="qwen3-tts-flash",
        provider="qwen",
        max_tokens=1024,
        capabilities=[ModelCapability.TTS],
        priority=1,
    ),
    "cosyvoice-v1": ModelConfig(
        model_id="cosyvoice-v1",
        provider="qwen",
        max_tokens=1024,
        capabilities=[ModelCapability.TTS],
        priority=2,
    ),

    # 图像生成模型
    "qwen-vl-image": ModelConfig(
        model_id="qwen-vl-image",
        provider="qwen",
        capabilities=[ModelCapability.IMAGE_GEN],
        priority=1,
    ),
    "wanx-v1": ModelConfig(
        model_id="wanx-v1",
        provider="qwen",
        capabilities=[ModelCapability.IMAGE_GEN],
        priority=2,
    ),
}

# 场景到模型能力的映射
SCENE_CAPABILITY_MAP: Dict[SceneType, ModelCapability] = {
    SceneType.OUTLINE_GENERATION: ModelCapability.TEXT,
    SceneType.SCENE_GENERATION: ModelCapability.TEXT,
    SceneType.AGENT_CHAT: ModelCapability.TEXT,
    SceneType.QUIZ_GRADING: ModelCapability.TEXT,
    SceneType.INTERACTIVE_GENERATION: ModelCapability.TEXT,  # 生成 HTML 代码，不需要视觉能力
    SceneType.IMAGE_DESCRIPTION: ModelCapability.VISION,
    SceneType.PDF_ANALYSIS: ModelCapability.VISION,
    SceneType.TTS_SYNTHESIS: ModelCapability.TTS,
}

# 场景到默认模型的映射
# 文本类场景统一使用 DEFAULT_MODEL 环境变量（docker-compose 配置），便于切换模型版本
_DEFAULT_TEXT_MODEL = os.environ.get("DEFAULT_MODEL", "qwen3.6-plus")
SCENE_MODEL_MAP: Dict[SceneType, str] = {
    SceneType.OUTLINE_GENERATION: _DEFAULT_TEXT_MODEL,
    SceneType.SCENE_GENERATION: _DEFAULT_TEXT_MODEL,
    SceneType.AGENT_CHAT: _DEFAULT_TEXT_MODEL,
    SceneType.QUIZ_GRADING: os.environ.get("QUIZ_GRADING_MODEL", "qwen-turbo"),  # 批改可以用更快的小模型
    SceneType.INTERACTIVE_GENERATION: _DEFAULT_TEXT_MODEL,  # HTML 代码生成用文本模型
    SceneType.IMAGE_DESCRIPTION: os.environ.get("VISION_MODEL_ID", "qwen-vl-max"),
    SceneType.PDF_ANALYSIS: os.environ.get("VISION_MODEL_ID", "qwen-vl-max"),
    SceneType.TTS_SYNTHESIS: os.environ.get("TTS_MODEL_ID", "qwen3-tts-flash"),
}


class ModelRouter:
    """
    模型路由器 - 根据场景选择合适的模型
    """

    def __init__(
        self,
        default_text_model: Optional[str] = None,
        default_vision_model: Optional[str] = None,
        default_tts_model: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        openai_api_base: Optional[str] = None,
        tts_api_key: Optional[str] = None,
        tts_api_base: Optional[str] = None,
    ):
        # 从settings读取配置，支持环境变量覆盖
        self.default_text_model = default_text_model or settings.DEFAULT_MODEL or "qwen/qwen3.6-plus"
        self.default_vision_model = default_vision_model or settings.VISION_MODEL_ID or "qwen-vl-max"
        self.default_tts_model = default_tts_model or settings.TTS_MODEL_ID or "qwen3-tts-flash"

        # API配置从settings读取
        self.openai_api_key = openai_api_key or settings.OPENAI_API_KEY
        self.openai_api_base = openai_api_base or settings.OPENAI_API_BASE
        self.tts_api_key = tts_api_key or settings.TTS_API_KEY or self.openai_api_key
        self.tts_api_base = tts_api_base or settings.TTS_API_BASE or self.openai_api_base

        # 模型配置缓存
        self._model_configs = DEFAULT_MODEL_CONFIGS.copy()

        logger.info(f"[ModelRouter] 初始化完成 - text={self.default_text_model}, vision={self.default_vision_model}, tts={self.default_tts_model}")

    def get_model_for_scene(self, scene_type: SceneType) -> str:
        """
        根据场景类型获取推荐模型

        Args:
            scene_type: 使用场景类型

        Returns:
            模型ID
        """
        # 优先使用场景特定配置
        if scene_type in SCENE_MODEL_MAP:
            model_id = SCENE_MODEL_MAP[scene_type]
            logger.debug(f"[ModelRouter] Scene {scene_type.value} -> model {model_id}")
            return model_id

        # 根据能力类型选择默认模型
        capability = SCENE_CAPABILITY_MAP.get(scene_type, ModelCapability.TEXT)

        if capability == ModelCapability.VISION:
            return self.default_vision_model
        elif capability == ModelCapability.TTS:
            return self.default_tts_model
        else:
            return self.default_text_model

    def get_model_config(self, model_id: str) -> ModelConfig:
        """
        获取模型配置
        """
        if model_id in self._model_configs:
            return self._model_configs[model_id]

        # 创建默认配置
        return ModelConfig(
            model_id=model_id,
            provider="openai",
            max_tokens=4096,
            temperature=0.7,
            capabilities=[ModelCapability.TEXT],
        )

    def get_api_config(self, model_id: str) -> Dict[str, str]:
        """
        获取模型API配置

        Returns:
            {"api_base": str, "api_key": str}
        """
        config = self.get_model_config(model_id)

        # TTS模型使用专用配置
        if ModelCapability.TTS in config.capabilities:
            return {
                "api_base": self.tts_api_base or self.openai_api_base,
                "api_key": self.tts_api_key or self.openai_api_key,
            }

        # 默认使用OpenAI兼容API
        return {
            "api_base": self.openai_api_base,
            "api_key": self.openai_api_key,
        }

    def should_use_vision_model(self, scene_type: SceneType, has_images: bool = False) -> bool:
        """
        判断是否需要使用多模态模型

        Args:
            scene_type: 场景类型
            has_images: 是否包含图片

        Returns:
            是否需要使用多模态模型
        """
        capability = SCENE_CAPABILITY_MAP.get(scene_type, ModelCapability.TEXT)

        if capability == ModelCapability.VISION:
            return True

        # 场景可能需要图片但不是强制的
        if scene_type == SceneType.INTERACTIVE_GENERATION and has_images:
            return True

        return False

    def get_fallback_model(self, model_id: str) -> Optional[str]:
        """
        获取降级模型

        Args:
            model_id: 当前模型ID

        Returns:
            降级模型ID，如果没有则返回None
        """
        config = self.get_model_config(model_id)
        return config.fallback_model

    def register_model(self, model_id: str, config: ModelConfig) -> None:
        """
        注册自定义模型配置
        """
        self._model_configs[model_id] = config
        logger.info(f"[ModelRouter] Registered model: {model_id}")

    def list_models(self, capability: Optional[ModelCapability] = None) -> List[str]:
        """
        列出可用模型

        Args:
            capability: 可选的能力过滤

        Returns:
            模型ID列表
        """
        if capability is None:
            return list(self._model_configs.keys())

        return [
            model_id for model_id, config in self._model_configs.items()
            if capability in config.capabilities
        ]


# 全局单例
_model_router: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    """获取全局模型路由器"""
    global _model_router
    if _model_router is None:
        _model_router = ModelRouter()
    return _model_router


def reset_model_router() -> None:
    """重置模型路由器（主要用于测试）"""
    global _model_router
    _model_router = None
