"""
Unit tests for Prompt Template System

Tests:
- load_snippet
- process_snippets
- process_conditional_blocks
- interpolate_variables
- build_prompt
"""

import pytest
import os
import sys

# Add app directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.generation.prompts import (
    load_snippet,
    process_snippets,
    process_conditional_blocks,
    interpolate_variables,
    build_prompt,
    PROMPT_IDS,
    SNIPPET_DIR,
    PROMPT_DIR,
)


class TestSnippetLoading:
    """测试Snippet加载功能"""

    def test_snippet_dir_exists(self):
        """Snippet目录存在"""
        assert os.path.exists(SNIPPET_DIR), f"Snippet directory not found: {SNIPPET_DIR}"

    def test_load_image_instructions_snippet(self):
        """加载image-instructions snippet"""
        content = load_snippet("image-instructions")
        assert content is not None
        assert len(content) > 0
        assert "image" in content.lower() or "图片" in content

    def test_load_video_instructions_snippet(self):
        """加载video-instructions snippet"""
        content = load_snippet("video-instructions")
        assert content is not None
        assert len(content) > 0

    def test_load_nonexistent_snippet_raises(self):
        """加载不存在的snippet抛出异常"""
        with pytest.raises(FileNotFoundError):
            load_snippet("nonexistent-snippet")


class TestSnippetProcessing:
    """测试Snippet引入处理"""

    def test_process_single_snippet(self):
        """处理单个snippet引入"""
        template = "Header content. {{snippet:image-instructions}} Footer."
        result = process_snippets(template)
        assert "{{snippet:image-instructions}}" not in result
        assert "Header content." in result
        assert "Footer." in result

    def test_process_multiple_snippets(self):
        """处理多个snippet引入"""
        template = "{{snippet:image-instructions}}\n{{snippet:video-instructions}}"
        result = process_snippets(template)
        assert "{{snippet:" not in result

    def test_process_nonexistent_snippet_keeps_placeholder(self):
        """处理不存在的snippet保留占位符"""
        template = "{{snippet:nonexistent}} content"
        result = process_snippets(template)
        assert "{{snippet:nonexistent}}" in result


class TestConditionalBlocks:
    """测试条件块处理"""

    def test_condition_true(self):
        """条件为True时保留内容"""
        template = "{{#if imageEnabled}}Image content{{/if}}"
        result = process_conditional_blocks(template, {"imageEnabled": True})
        assert "Image content" in result
        assert "{{#if" not in result

    def test_condition_false(self):
        """条件为False时移除内容"""
        template = "{{#if imageEnabled}}Image content{{/if}}"
        result = process_conditional_blocks(template, {"imageEnabled": False})
        assert "Image content" not in result
        assert "{{#if" not in result

    def test_condition_missing(self):
        """条件不存在时移除内容"""
        template = "{{#if videoEnabled}}Video content{{/if}}"
        result = process_conditional_blocks(template, {"imageEnabled": True})
        assert "Video content" not in result

    def test_multiple_conditions(self):
        """多个条件块"""
        template = "{{#if imageEnabled}}Images{{/if}} {{#if videoEnabled}}Videos{{/if}}"
        result = process_conditional_blocks(template, {"imageEnabled": True, "videoEnabled": False})
        assert "Images" in result
        assert "Videos" not in result


class TestVariableInterpolation:
    """测试变量插值"""

    def test_string_interpolation(self):
        """字符串变量插值"""
        template = "Title: {{title}}"
        result = interpolate_variables(template, {"title": "Test Title"})
        assert result == "Title: Test Title"

    def test_boolean_interpolation(self):
        """布尔值变量插值"""
        template = "Enabled: {{enabled}}"
        result = interpolate_variables(template, {"enabled": True})
        assert result == "Enabled: True"

    def test_integer_interpolation(self):
        """整数变量插值"""
        template = "Width: {{width}}"
        result = interpolate_variables(template, {"width": 1000})
        assert result == "Width: 1000"

    def test_none_interpolation(self):
        """None值变量插值"""
        template = "Value: {{value}}"
        result = interpolate_variables(template, {"value": None})
        assert result == "Value: "

    def test_multiple_variables(self):
        """多变量插值"""
        template = "{{title}} by {{author}}"
        result = interpolate_variables(template, {"title": "Test", "author": "Author"})
        assert result == "Test by Author"


class TestBuildPrompt:
    """测试完整prompt构建"""

    def test_build_slide_content_prompt(self):
        """构建slide-content prompt"""
        system, user = build_prompt(
            "slide-content",
            {
                "title": "Test Slide",
                "description": "Test description",
                "keyPoints": "Point 1, Point 2",
                "languageDirective": "Output in Chinese.",
                "teacherContext": "",
                "canvas_width": 1000,
                "canvas_height": 562,
            },
            conditions={
                "imageElementEnabled": False,
                "generatedImageEnabled": False,
                "generatedVideoEnabled": False,
            }
        )
        assert system is not None
        assert user is not None
        assert "Test Slide" in user
        assert "Test description" in user

    def test_build_prompt_with_boolean_conditions(self):
        """布尔变量作为条件"""
        system, user = build_prompt(
            "slide-content",
            {
                "title": "Test",
                "description": "Test",
                "generatedImageEnabled": True,  # 布尔值
            }
        )
        assert system is not None or user is not None

    def test_build_nonexistent_prompt_returns_none(self):
        """不存在prompt返回None"""
        system, user = build_prompt("nonexistent-prompt", {})
        assert system is None
        assert user is None


class TestTemplateDirectory:
    """测试模板目录结构"""

    def test_slide_content_template_exists(self):
        """slide-content模板存在"""
        slide_dir = os.path.join(PROMPT_DIR, "slide-content")
        assert os.path.exists(slide_dir)
        assert os.path.exists(os.path.join(slide_dir, "system.md"))
        assert os.path.exists(os.path.join(slide_dir, "user.md"))

    def test_widget_templates_exist(self):
        """Widget模板目录存在"""
        widget_types = ["simulation-content", "game-content", "diagram-content", "code-content", "visualization3d-content"]
        for widget_type in widget_types:
            widget_dir = os.path.join(PROMPT_DIR, widget_type)
            assert os.path.exists(widget_dir), f"Widget template not found: {widget_type}"
            assert os.path.exists(os.path.join(widget_dir, "system.md"))
            assert os.path.exists(os.path.join(widget_dir, "user.md"))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])