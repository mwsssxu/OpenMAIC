"""
Unit tests for Thinking Configuration System

Tests:
- get_thinking_capability
- build_thinking_params
- Provider-specific parameter mapping
"""

import pytest
import os
import sys

# Add app directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.model_metadata import (
    get_thinking_capability,
    build_thinking_params,
    get_default_thinking_config,
    get_model_key,
    THINKING_CAPABILITIES,
)


class TestThinkingCapabilities:
    """测试Thinking能力配置表"""

    def test_capabilities_not_empty(self):
        """能力配置表不为空"""
        assert len(THINKING_CAPABILITIES) > 0

    def test_openai_capability(self):
        """OpenAI GPT-5.5能力"""
        cap = get_thinking_capability("openai", "gpt-5.5")
        assert cap is not None
        assert cap.get("control") == "effort"
        assert "effort_values" in cap
        assert "medium" in cap.get("effort_values", [])

    def test_anthropic_capability(self):
        """Anthropic Claude能力"""
        cap = get_thinking_capability("anthropic", "claude-opus-4-7")
        assert cap is not None
        assert cap.get("control") == "effort"
        assert cap.get("request_adapter") == "anthropic"

    def test_qwen_capability(self):
        """Qwen能力"""
        cap = get_thinking_capability("qwen", "qwen3.6-plus")
        assert cap is not None
        assert cap.get("control") == "toggle-budget"
        assert "budget_range" in cap

    def test_nonexistent_model(self):
        """不存在模型返回None"""
        cap = get_thinking_capability("unknown", "unknown-model")
        assert cap is None


class TestBuildThinkingParams:
    """测试Thinking参数构建"""

    def test_openai_effort_params(self):
        """OpenAI reasoning_effort参数"""
        params = build_thinking_params("openai", "gpt-5.5", {"effort": "high"})
        assert "reasoning_effort" in params
        assert params["reasoning_effort"] == "high"

    def test_openai_none_effort_skipped(self):
        """OpenAI effort=none不添加参数"""
        params = build_thinking_params("openai", "gpt-5.5", {"effort": "none"})
        assert "reasoning_effort" not in params

    def test_anthropic_adaptive_params(self):
        """Anthropic adaptive thinking参数"""
        params = build_thinking_params("anthropic", "claude-opus-4-7", {"enabled": True})
        assert "thinking" in params
        assert params["thinking"].get("type") == "adaptive"

    def test_qwen_budget_params(self):
        """Qwen thinking_budget参数"""
        params = build_thinking_params("qwen", "qwen3.6-plus", {"enabled": True, "budget_tokens": 8192})
        assert params.get("enable_thinking") == True
        assert params.get("thinking_budget") == 8192

    def test_qwen_disabled_no_params(self):
        """Qwen disabled不添加参数"""
        params = build_thinking_params("qwen", "qwen3.6-plus", {"enabled": False})
        assert "enable_thinking" not in params

    def test_deepseek_effort_params(self):
        """DeepSeek reasoning_effort参数"""
        params = build_thinking_params("deepseek", "deepseek-v4-pro", {"effort": "max"})
        assert "reasoning_effort" in params
        assert params["reasoning_effort"] == "max"

    def test_control_none_returns_empty(self):
        """control=none返回空参数"""
        # 无thinking能力的模型
        params = build_thinking_params("unknown", "unknown-model", {"enabled": True})
        assert params == {}

    def test_empty_config_returns_empty(self):
        """空配置返回空参数"""
        params = build_thinking_params("openai", "gpt-5.5", {})
        # 默认effort是medium，应该添加
        assert "reasoning_effort" in params


class TestDefaultThinkingConfig:
    """测试默认配置获取"""

    def test_get_default_config(self):
        """获取默认配置"""
        config = get_default_thinking_config("openai", "gpt-5.5")
        assert config is not None
        assert "enabled" in config
        assert "effort" in config

    def test_get_default_config_nonexistent(self):
        """不存在模型返回None"""
        config = get_default_thinking_config("unknown", "unknown-model")
        assert config is None


class TestModelKey:
    """测试模型key生成"""

    def test_model_key_format(self):
        """模型key格式"""
        key = get_model_key("openai", "gpt-5.5")
        assert key == "openai:gpt-5.5"

    def test_model_key_in_capabilities(self):
        """生成的key存在于能力表"""
        key = get_model_key("openai", "gpt-5.5")
        assert key in THINKING_CAPABILITIES


if __name__ == "__main__":
    pytest.main([__file__, "-v"])