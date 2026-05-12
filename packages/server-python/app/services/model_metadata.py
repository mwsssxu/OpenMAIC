"""
模型元数据 - Thinking/Reasoning配置

从Web端同步的核心thinking配置
支持不同Provider的thinking参数映射
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass


@dataclass
class ThinkingCapability:
    """模型Thinking能力描述"""
    control: str = "none"  # none, toggle, toggle-budget, effort, level, mode, budget-only
    request_adapter: str = "none"
    default_mode: str = "enabled"
    effort_values: Optional[List[str]] = None
    default_effort: Optional[str] = None
    level_values: Optional[List[str]] = None
    default_level: Optional[str] = None
    budget_range: Optional[Dict[str, int]] = None
    default_budget_tokens: Optional[int] = None
    toggleable: bool = False
    budget_adjustable: bool = False
    default_enabled: bool = True


def get_model_key(provider_id: str, model_id: str) -> str:
    """生成模型key"""
    return f"{provider_id}:{model_id}"


# Thinking能力配置表（从Web端model-metadata.ts同步）
THINKING_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    # OpenAI
    get_model_key("openai", "gpt-5.5"): {
        "control": "effort",
        "request_adapter": "openai",
        "effort_values": ["low", "medium", "high", "xhigh"],
        "default_effort": "medium",
        "toggleable": False,
        "budget_adjustable": True,
    },
    get_model_key("openai", "gpt-5.4-pro"): {
        "control": "effort",
        "request_adapter": "openai",
        "effort_values": ["medium", "high", "xhigh"],
        "default_effort": "medium",
    },
    get_model_key("openai", "gpt-5.4"): {
        "control": "effort",
        "request_adapter": "openai",
        "effort_values": ["none", "low", "medium", "high", "xhigh"],
        "default_effort": "none",
        "default_enabled": False,
    },

    # Anthropic
    get_model_key("anthropic", "claude-opus-4-7"): {
        "control": "effort",
        "request_adapter": "anthropic",
        "effort_values": ["none", "low", "medium", "high", "xhigh", "max"],
        "default_effort": "medium",
        "anthropic_thinking": {"type": "adaptive"},
    },
    get_model_key("anthropic", "claude-opus-4-6"): {
        "control": "effort",
        "request_adapter": "anthropic",
        "effort_values": ["none", "low", "medium", "high", "max"],
        "default_effort": "medium",
        "anthropic_thinking": {"type": "adaptive"},
    },
    get_model_key("anthropic", "claude-sonnet-4-6"): {
        "control": "effort",
        "request_adapter": "anthropic",
        "effort_values": ["none", "low", "medium", "high", "max"],
        "default_effort": "medium",
        "anthropic_thinking": {"type": "adaptive"},
    },
    get_model_key("anthropic", "claude-haiku-4-5"): {
        "control": "toggle-budget",
        "request_adapter": "anthropic",
        "budget_range": {"min": 1024, "max": 64000, "step": 1024},
        "default_budget_tokens": 1024,
        "default_enabled": False,
    },

    # DeepSeek
    get_model_key("deepseek", "deepseek-v4-pro"): {
        "control": "effort",
        "request_adapter": "deepseek",
        "effort_values": ["none", "high", "max"],
        "default_effort": "high",
    },
    get_model_key("deepseek", "deepseek-v4-flash"): {
        "control": "effort",
        "request_adapter": "deepseek",
        "effort_values": ["none", "high", "max"],
        "default_effort": "high",
    },

    # Qwen
    get_model_key("qwen", "qwen3.6-max-preview"): {
        "control": "toggle-budget",
        "request_adapter": "qwen",
        "budget_range": {"min": 0, "max": 81920, "step": 1024, "disableValue": 0},
        "default_enabled": False,
    },
    get_model_key("qwen", "qwen3.6-plus"): {
        "control": "toggle-budget",
        "request_adapter": "qwen",
        "budget_range": {"min": 0, "max": 81920, "step": 1024, "disableValue": 0},
        "default_enabled": True,
    },

    # Google
    get_model_key("google", "gemini-3.1-pro-preview"): {
        "control": "level",
        "request_adapter": "google",
        "level_values": ["minimal", "low", "medium", "high"],
        "default_level": "high",
    },
    get_model_key("google", "gemini-2.5-pro"): {
        "control": "budget-only",
        "request_adapter": "google",
        "budget_range": {"min": 128, "max": 32768, "step": 1024, "allowDynamic": True},
        "default_budget_tokens": -1,
    },

    # GLM
    get_model_key("glm", "glm-5.1"): {
        "control": "toggle",
        "request_adapter": "glm",
        "default_enabled": True,
    },
    get_model_key("glm", "glm-5"): {
        "control": "toggle",
        "request_adapter": "glm",
    },

    # Kimi
    get_model_key("kimi", "kimi-k2.6"): {
        "control": "toggle",
        "request_adapter": "kimi",
    },
    get_model_key("kimi", "kimi-k2-thinking"): {
        "control": "toggle",
        "request_adapter": "kimi",
    },

    # Doubao
    get_model_key("doubao", "doubao-seed-2-0-pro-260215"): {
        "control": "effort",
        "request_adapter": "doubao",
        "effort_values": ["minimal", "low", "medium", "high"],
        "default_effort": "medium",
    },

    # Tencent Hunyuan
    get_model_key("tencent-hunyuan", "hy3-preview"): {
        "control": "effort",
        "request_adapter": "hunyuan",
        "effort_values": ["none", "low", "high"],
        "default_effort": "none",
        "default_enabled": False,
    },

    # Xiaomi MiMo
    get_model_key("xiaomi", "mimo-v2.5-pro"): {
        "control": "toggle",
        "request_adapter": "xiaomi",
    },

    # Lemonade (本地模型)
    get_model_key("lemonade", "Qwen3-4B-GGUF"): {
        "control": "toggle-budget",
        "request_adapter": "lemonade",
        "budget_range": {"min": 0, "max": 81920, "step": 1024, "disableValue": 0},
        "default_enabled": False,
    },
}


def get_thinking_capability(provider_id: str, model_id: str) -> Optional[Dict[str, Any]]:
    """
    获取模型的thinking能力配置

    Args:
        provider_id: Provider ID
        model_id: Model ID

    Returns:
        Thinking能力配置字典，如果模型不支持thinking则返回None
    """
    key = get_model_key(provider_id, model_id)
    return THINKING_CAPABILITIES.get(key)


def build_thinking_params(
    provider_id: str,
    model_id: str,
    thinking_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    根据模型和配置构建Provider特定的thinking请求参数

    Args:
        provider_id: Provider ID
        model_id: Model ID
        thinking_config: 用户提供的thinking配置

    Returns:
        Provider特定的thinking请求参数字典
    """
    capability = get_thinking_capability(provider_id, model_id)
    if not capability or capability.get("control") == "none":
        return {}

    adapter = capability.get("request_adapter", "none")
    if adapter == "none":
        return {}

    # 获取用户配置或使用默认值
    enabled = thinking_config.get("enabled", capability.get("default_enabled", True))
    effort = thinking_config.get("effort", capability.get("default_effort"))
    budget_tokens = thinking_config.get("budget_tokens", capability.get("default_budget_tokens"))

    # 根据adapter构建参数
    params = {}

    if adapter == "openai":
        if effort and effort != "none":
            params["reasoning_effort"] = effort

    elif adapter == "anthropic":
        if enabled:
            anthropic_thinking = capability.get("anthropic_thinking", {})
            thinking_type = anthropic_thinking.get("type", "enabled")
            if thinking_type == "adaptive":
                params["thinking"] = {"type": "adaptive"}
            else:
                # budget模式
                budget_by_effort = anthropic_thinking.get("budgetByEffort", {})
                if effort and effort in budget_by_effort:
                    params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": budget_by_effort[effort]
                    }
                elif budget_tokens:
                    params["thinking"] = {
                        "type": "enabled",
                        "budget_tokens": budget_tokens
                    }

    elif adapter == "deepseek":
        if effort and effort != "none":
            # DeepSeek使用reasoning_effort或thinking_budget
            params["reasoning_effort"] = effort

    elif adapter == "qwen":
        if enabled and budget_tokens and budget_tokens > 0:
            params["enable_thinking"] = True
            params["thinking_budget"] = budget_tokens

    elif adapter == "google":
        if capability.get("control") == "level":
            level = thinking_config.get("level", capability.get("default_level"))
            if level:
                params["thinkingConfig"] = {"thinkingBudget": level}
        elif capability.get("control") in ("budget-only", "toggle-budget"):
            if budget_tokens and budget_tokens > 0:
                params["thinkingConfig"] = {"thinkingBudget": budget_tokens}

    elif adapter == "glm":
        if enabled:
            params["enable_thinking"] = True

    elif adapter == "kimi":
        if enabled:
            params["enable_thinking"] = True

    elif adapter == "doubao":
        if effort:
            params["reasoning_effort"] = effort

    elif adapter == "hunyuan":
        if effort and effort != "none":
            params["reasoning_effort"] = effort

    elif adapter == "xiaomi":
        if enabled:
            params["enable_thinking"] = True

    elif adapter == "lemonade":
        if enabled and budget_tokens and budget_tokens > 0:
            params["thinking_budget"] = budget_tokens

    return params


def get_default_thinking_config(provider_id: str, model_id: str) -> Optional[Dict[str, Any]]:
    """
    获取模型的默认thinking配置

    Args:
        provider_id: Provider ID
        model_id: Model ID

    Returns:
        默认thinking配置字典
    """
    capability = get_thinking_capability(provider_id, model_id)
    if not capability or capability.get("control") == "none":
        return None

    return {
        "enabled": capability.get("default_enabled", True),
        "effort": capability.get("default_effort"),
        "budget_tokens": capability.get("default_budget_tokens"),
    }