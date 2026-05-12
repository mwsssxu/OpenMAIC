"""
Unit tests for scene_generator 新增的辅助函数：
- _actions_prompt_id（按场景类型分派）
- _normalize_actions（统一两种输出格式）
- _build_agents_block（agents 文本块构建）

以及 generate.py 中的 _extract_rewritten_query（web-search query 重写结果抽取）。
"""

import os
import sys

import pytest

# 让测试可独立运行
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.generation.scene_generator import (
    _actions_prompt_id,
    _build_agents_block,
    _normalize_actions,
    _resolve_widget_prompt_id,
    parse_json_response,
    Action,
)
from app.routes.generate import _extract_rewritten_query


class TestActionsPromptIdDispatch:
    """按场景类型返回对应 actions 模板 ID"""

    def test_slide(self):
        assert _actions_prompt_id("slide") == "slide-actions"

    def test_quiz(self):
        assert _actions_prompt_id("quiz") == "quiz-actions"

    def test_interactive(self):
        assert _actions_prompt_id("interactive") == "interactive-actions"

    def test_pbl(self):
        assert _actions_prompt_id("pbl") == "pbl-actions"

    def test_unknown_fallback_to_slide(self):
        assert _actions_prompt_id("unknown") == "slide-actions"
        assert _actions_prompt_id("") == "slide-actions"


class TestBuildAgentsBlock:
    def test_empty(self):
        assert _build_agents_block(None) == ""
        assert _build_agents_block([]) == ""

    def test_single_agent(self):
        # 非 teacher 角色不被过滤
        block = _build_agents_block([
            {"name": "Alice", "role": "assistant", "persona": "严谨认真"}
        ])
        assert "Alice" in block
        assert "assistant" in block
        assert "严谨认真" in block
        assert block.startswith("## ")

    def test_exclude_teacher_by_default(self):
        """默认排除 role=teacher，避免与 teacherContext 重复信息"""
        block = _build_agents_block([
            {"name": "T", "role": "teacher", "persona": "学科带头人"}
        ])
        assert block == ""

    def test_include_teacher_when_disabled(self):
        block = _build_agents_block(
            [{"name": "T", "role": "teacher", "persona": "学科带头人"}],
            exclude_teacher=False,
        )
        assert "T" in block

    def test_limit_truncate(self):
        agents = [
            {"name": f"A{i}", "role": "assistant", "persona": "p"} for i in range(5)
        ]
        block = _build_agents_block(agents, limit=2)
        assert "A0" in block and "A1" in block
        assert "A2" not in block


class TestResolveWidgetPromptId:
    """映射表：标准 widget 走 f"{type}-content"，html / scientific-model 走特殊命名"""

    def test_standard_widgets(self):
        assert _resolve_widget_prompt_id("simulation") == "simulation-content"
        assert _resolve_widget_prompt_id("game") == "game-content"
        assert _resolve_widget_prompt_id("code") == "code-content"
        assert _resolve_widget_prompt_id("diagram") == "diagram-content"
        assert _resolve_widget_prompt_id("visualization3d") == "visualization3d-content"

    def test_html_override(self):
        assert _resolve_widget_prompt_id("html") == "interactive-html"

    def test_scientific_model_override(self):
        assert _resolve_widget_prompt_id("scientific-model") == "interactive-scientific-model"


class TestNormalizeActions:
    """覆盖 Web 端输出的两种主要格式及兼容分支"""

    def test_text_type_to_speech(self):
        result = _normalize_actions([
            {"type": "text", "content": "欢迎学习本节课"}
        ])
        assert len(result) == 1
        assert isinstance(result[0], Action)
        assert result[0].type == "speech"
        assert result[0].data["text"] == "欢迎学习本节课"
        assert result[0].id  # 应自动生成

    def test_action_spotlight_rename_element_id(self):
        result = _normalize_actions([
            {"type": "action", "name": "spotlight", "params": {"elementId": "text_1"}}
        ])
        assert len(result) == 1
        assert result[0].type == "spotlight"
        assert result[0].data["target_element_id"] == "text_1"
        # elementId 不应冗余保留
        assert "elementId" not in result[0].data

    def test_action_laser(self):
        result = _normalize_actions([
            {"type": "action", "name": "laser", "params": {"elementId": "img_x"}}
        ])
        assert result[0].type == "laser"
        assert result[0].data["target_element_id"] == "img_x"

    def test_action_discussion(self):
        result = _normalize_actions([
            {"type": "action", "name": "discussion", "params": {"topic": "为什么"}}
        ])
        assert result[0].type == "discussion"
        assert result[0].data["topic"] == "为什么"

    def test_legacy_speech_format(self):
        """兼容旧格式 {type:'speech', data:{text:...}}"""
        result = _normalize_actions([
            {"type": "speech", "data": {"text": "hello"}}
        ])
        assert len(result) == 1
        assert result[0].type == "speech"
        assert result[0].data["text"] == "hello"

    def test_mixed_sequence(self):
        result = _normalize_actions([
            {"type": "action", "name": "spotlight", "params": {"elementId": "e1"}},
            {"type": "text", "content": "讲解一下"},
            {"type": "action", "name": "laser", "params": {"elementId": "e2"}},
        ])
        assert [a.type for a in result] == ["spotlight", "speech", "laser"]

    def test_skip_invalid_items(self):
        result = _normalize_actions([
            "not a dict",
            {"type": "action", "name": "unknown_action", "params": {}},  # 未知 name
            {"type": "text", "content": "ok"},
            None,
        ])
        # 未知 action name 与非 dict 都被跳过
        assert len(result) == 1
        assert result[0].type == "speech"

    def test_preserve_given_id(self):
        result = _normalize_actions([
            {"id": "custom-id-1", "type": "text", "content": "hi"}
        ])
        assert result[0].id == "custom-id-1"

    def test_spotlight_params_with_both_keys_no_override(self):
        """params 同时带 elementId 和 target_element_id 时，target_element_id 应优先来自 params"""
        result = _normalize_actions([
            {
                "type": "action",
                "name": "spotlight",
                "params": {
                    "elementId": "legacy_id",
                    "target_element_id": "preferred_id",
                    "duration": 2000,
                },
            }
        ])
        assert result[0].type == "spotlight"
        # preferred_id 优先于 legacy_id，避免被 params 解包覆盖
        assert result[0].data["target_element_id"] == "preferred_id"
        assert result[0].data["duration"] == 2000
        assert "elementId" not in result[0].data

    def test_skip_only_element_id_fallback(self):
        """params 只有 elementId（旧名）时正确映射为 target_element_id"""
        result = _normalize_actions([
            {"type": "action", "name": "spotlight", "params": {"elementId": "only_legacy"}}
        ])
        assert result[0].data["target_element_id"] == "only_legacy"


class TestParseJsonResponseForQuiz:
    """验证 quiz 数组解析分支（P0 bug 修复）"""

    def test_parse_quiz_as_array(self):
        raw = '[{"id":"q1","type":"single","question":"1+1=?","answer":["2"]}]'
        result = parse_json_response(raw, "quiz")
        assert result["type"] == "quiz"
        assert isinstance(result["questions"], list)
        assert result["questions"][0]["id"] == "q1"

    def test_parse_quiz_array_with_markdown_fence(self):
        raw = '```json\n[{"id":"q1","type":"single","question":"X","answer":["A"]}]\n```'
        result = parse_json_response(raw, "quiz")
        assert len(result["questions"]) == 1

    def test_parse_quiz_object_wrapping_fallback(self):
        """如果模型返了 {questions:[...]} 格式，也能被正确补正"""
        raw = '{"questions":[{"id":"q1","type":"single","question":"X"}]}'
        result = parse_json_response(raw, "quiz")
        assert result["type"] == "quiz"
        assert len(result["questions"]) == 1

    def test_parse_quiz_invalid_returns_default(self):
        result = parse_json_response("not json", "quiz")
        assert result == {"type": "quiz", "questions": []}

    def test_parse_slide_still_object(self):
        """回归测试：slide 分支仍然正常解析对象"""
        raw = '{"type":"slide","canvas":{"elements":[]}}'
        result = parse_json_response(raw, "slide")
        assert result["type"] == "slide"
        assert result["canvas"]["elements"] == []


class TestExtractRewrittenQuery:
    def test_plain_json(self):
        assert _extract_rewritten_query('{"query":"transformer attention"}') == "transformer attention"

    def test_markdown_wrapped(self):
        raw = '```json\n{"query":"BERT 预训练"}\n```'
        assert _extract_rewritten_query(raw) == "BERT 预训练"

    def test_json_with_extra_text(self):
        raw = '这是解释\n{"query":"注意力"} 以上'
        assert _extract_rewritten_query(raw) == "注意力"

    def test_empty_string(self):
        assert _extract_rewritten_query("") is None
        assert _extract_rewritten_query("   ") is None

    def test_malformed_json(self):
        assert _extract_rewritten_query("{not json}") is None

    def test_missing_query_field(self):
        assert _extract_rewritten_query('{"other":"value"}') is None

    def test_non_string_query(self):
        assert _extract_rewritten_query('{"query": 123}') is None

    def test_whitespace_only_query(self):
        assert _extract_rewritten_query('{"query":"   "}') is None

    def test_query_with_backticks_inside(self):
        """query 内部包含反引号不应被损坏（P2 修复）"""
        raw = '```json\n{"query":"use `useEffect` hook pattern"}\n```'
        assert _extract_rewritten_query(raw) == "use `useEffect` hook pattern"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
