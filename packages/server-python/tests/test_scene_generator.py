"""
Unit tests for Scene Generator

Tests:
- SceneOutline model with widget fields
- format_teacher_persona_for_prompt
- parse_json_response
- fix_element_format
"""

import pytest
import os
import sys
import json

# Add app directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.generation.outline_generator import SceneOutline
from app.services.generation.scene_generator import (
    format_teacher_persona_for_prompt,
    parse_json_response,
    fix_element_format,
)


class TestSceneOutlineModel:
    """测试SceneOutline模型"""

    def test_basic_scene_outline(self):
        """基本大纲创建"""
        outline = SceneOutline(
            id="test-id",
            title="Test Title",
            type="slide",
            description="Test description",
            order=1,
        )
        assert outline.id == "test-id"
        assert outline.title == "Test Title"
        assert outline.type == "slide"
        assert outline.key_points == []

    def test_scene_outline_with_widget_type(self):
        """带widget_type的大纲"""
        outline = SceneOutline(
            id="test-id",
            title="Simulation Scene",
            type="interactive",
            description="Physics simulation",
            order=2,
            widget_type="simulation",
            widget_outline={"param1": "value1"},
        )
        assert outline.widget_type == "simulation"
        assert outline.widget_outline == {"param1": "value1"}

    def test_scene_outline_with_quiz_config(self):
        """带quiz_config的大纲"""
        outline = SceneOutline(
            id="quiz-id",
            title="Quiz",
            type="quiz",
            description="Knowledge check",
            order=3,
            quiz_config={"questionCount": 3, "difficulty": "medium"},
        )
        assert outline.quiz_config == {"questionCount": 3, "difficulty": "medium"}

    def test_scene_outline_with_key_points(self):
        """带key_points的大纲"""
        outline = SceneOutline(
            id="test-id",
            title="Test",
            type="slide",
            description="Test",
            order=1,
            key_points=["Point 1", "Point 2", "Point 3"],
        )
        assert len(outline.key_points) == 3


class TestTeacherPersonaFormat:
    """测试教师人设格式化"""

    def test_format_with_teacher_agent(self):
        """有教师智能体时格式化"""
        agents = [
            {"role": "teacher", "name": "Dr. Smith", "persona": "Expert in physics"},
            {"role": "assistant", "name": "Helper", "persona": "Helpful assistant"},
        ]
        result = format_teacher_persona_for_prompt(agents)
        assert "Teacher Persona" in result
        assert "Dr. Smith" in result
        assert "Expert in physics" in result

    def test_format_without_teacher_agent(self):
        """无教师智能体时返回空"""
        agents = [
            {"role": "assistant", "name": "Helper", "persona": "Helpful"},
        ]
        result = format_teacher_persona_for_prompt(agents)
        assert result == ""

    def test_format_empty_agents(self):
        """空智能体列表"""
        result = format_teacher_persona_for_prompt([])
        assert result == ""

    def test_format_none_agents(self):
        """None智能体列表"""
        result = format_teacher_persona_for_prompt(None)
        assert result == ""


class TestParseJsonResponse:
    """测试JSON解析"""

    def test_parse_clean_json(self):
        """解析干净JSON"""
        response = '{"type": "slide", "canvas": {"width": 1000}}'
        result = parse_json_response(response, "slide")
        assert result["type"] == "slide"
        assert result["canvas"]["width"] == 1000

    def test_parse_json_with_markdown(self):
        """解析带markdown的JSON"""
        response = '```json\n{"type": "slide", "canvas": {"width": 1000}}\n```'
        result = parse_json_response(response, "slide")
        assert result["type"] == "slide"

    def test_parse_json_with_extra_text(self):
        """解析带额外文本的JSON"""
        response = 'Here is the result: {"type": "slide", "canvas": {"width": 1000}} End.'
        result = parse_json_response(response, "slide")
        assert result["type"] == "slide"

    def test_parse_invalid_json_returns_default(self):
        """解析无效JSON返回默认"""
        response = "This is not JSON"
        result = parse_json_response(response, "slide")
        assert result["type"] == "slide"
        assert "canvas" in result
        assert result["canvas"]["elements"] == []

    def test_parse_quiz_json(self):
        """解析Quiz JSON"""
        response = '{"type": "quiz", "questions": [{"id": "q1", "question": "Test?"}]}'
        result = parse_json_response(response, "quiz")
        assert result["type"] == "quiz"
        assert len(result["questions"]) == 1


class TestFixElementFormat:
    """测试元素格式修复"""

    def test_fix_nested_position(self):
        """修复嵌套position"""
        content = {
            "canvas": {
                "elements": [
                    {
                        "id": "el1",
                        "type": "text",
                        "position": {"left": 50, "top": 100, "width": 200, "height": 50},
                        "content": "Test",
                    }
                ]
            }
        }
        result = fix_element_format(content)
        el = result["canvas"]["elements"][0]
        assert el["left"] == 50
        assert el["top"] == 100
        assert "position" not in el

    def test_fix_text_element_defaults(self):
        """添加text元素默认属性"""
        content = {
            "canvas": {
                "elements": [
                    {"id": "el1", "type": "text", "left": 50, "top": 100, "width": 200, "height": 50}
                ]
            }
        }
        result = fix_element_format(content)
        el = result["canvas"]["elements"][0]
        assert el.get("defaultColor") == "#333333"
        assert el.get("defaultFontName") == ""

    def test_fix_shape_element_defaults(self):
        """添加shape元素默认属性"""
        content = {
            "canvas": {
                "elements": [
                    {"id": "el1", "type": "shape", "left": 50, "top": 100, "width": 100, "height": 100}
                ]
            }
        }
        result = fix_element_format(content)
        el = result["canvas"]["elements"][0]
        assert "path" in el
        assert "viewBox" in el
        assert el.get("fixedRatio") == False

    def test_no_elements_returns_same(self):
        """无元素返回原内容"""
        content = {"type": "slide", "canvas": {"elements": []}}
        result = fix_element_format(content)
        assert result["canvas"]["elements"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])