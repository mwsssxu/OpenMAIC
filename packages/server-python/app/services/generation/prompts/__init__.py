"""
Prompt Templates - 与Web端一致的prompt管理系统

功能：
- 基于文件的prompt存储
- 变量插值 {{variable}}
- Snippet引入 {{snippet:name}}
- 条件块 {{#if condition}}...{{/if}}
- 支持多场景类型配置
"""

import os
import re
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

PROMPT_DIR = os.path.join(os.path.dirname(__file__), "templates")
SNIPPET_DIR = os.path.join(os.path.dirname(__file__), "snippets")

PROMPT_IDS = {
    "REQUIREMENTS_TO_OUTLINES": "requirements-to-outlines",
    "INTERACTIVE_OUTLINES": "interactive-outlines",
    "SLIDE_CONTENT": "slide-content",
    "SLIDE_ACTIONS": "slide-actions",
    "QUIZ_CONTENT": "quiz-content",
    "QUIZ_ACTIONS": "quiz-actions",
    "INTERACTIVE_WIDGET": "interactive-widget",
    "INTERACTIVE_ACTIONS": "interactive-actions",
    "INTERACTIVE_HTML": "interactive-html",
    "INTERACTIVE_SCIENTIFIC_MODEL": "interactive-scientific-model",
    "SIMULATION_CONTENT": "simulation-content",
    "GAME_CONTENT": "game-content",
    "DIAGRAM_CONTENT": "diagram-content",
    "CODE_CONTENT": "code-content",
    "VISUALIZATION3D_CONTENT": "visualization3d-content",
    "PBL_ACTIONS": "pbl-actions",
    "WEB_SEARCH_QUERY_REWRITE": "web-search-query-rewrite",
    # Agent 系统提示词（白板角色）
    "AGENT_SYSTEM_WB_TEACHER": "agent-system-wb-teacher",
    "AGENT_SYSTEM_WB_ASSISTANT": "agent-system-wb-assistant",
    "AGENT_SYSTEM_WB_STUDENT": "agent-system-wb-student",
    # Director 路由模板
    "DIRECTOR": "director",
}


def load_snippet(snippet_id: str) -> str:
    """
    加载snippet文件

    Args:
        snippet_id: Snippet ID，如 "image-instructions"

    Returns:
        Snippet内容，如果不存在则抛出异常
    """
    snippet_path = os.path.join(SNIPPET_DIR, f"{snippet_id}.md")

    try:
        with open(snippet_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        # Fail loud - missing snippet is a config bug
        raise FileNotFoundError(f"Snippet not found: {snippet_id} at {snippet_path}")
    except Exception as e:
        logger.warning(f"Failed to load snippet {snippet_id}: {e}")
        raise


def process_snippets(template: str, _depth: int = 0) -> str:
    """
    处理snippet引入 {{snippet:name}}，支持递归（snippet内可引用其他snippet）

    Args:
        template: 模板文本
        _depth: 递归深度（防止无限循环）

    Returns:
        处理后的文本
    """
    if _depth > 5:
        logger.warning("[snippets] Max recursion depth reached, stopping")
        return template

    pattern = r'\{\{snippet:(\w[\w-]*)\}\}'

    def replace_snippet(match):
        snippet_id = match.group(1)
        try:
            content = load_snippet(snippet_id)
            # 递归处理snippet内部可能引用的其他snippet
            return process_snippets(content, _depth + 1)
        except FileNotFoundError:
            # 保留原始占位符，避免破坏模板
            logger.warning(f"Snippet {snippet_id} not found, keeping placeholder")
            return match.group(0)

    return re.sub(pattern, replace_snippet, template)


def process_conditional_blocks(template: str, conditions: Dict[str, bool]) -> str:
    """
    处理条件块 {{#if condition}}...{{/if}}

    Args:
        template: 模板文本
        conditions: 条件字典

    Returns:
        处理后的文本
    """
    pattern = r'\{\{#if (\w+)\}\}([\s\S]*?)\{\{/if\}\}'

    def replace_conditional(match):
        condition_name = match.group(1)
        content = match.group(2)
        # 检查条件是否为True
        if conditions.get(condition_name, False):
            return content
        return ''

    return re.sub(pattern, replace_conditional, template)


def load_prompt(prompt_id: str) -> Tuple[Optional[str], Optional[str]]:
    """
    加载prompt模板（system + user）

    Args:
        prompt_id: Prompt ID，如 "requirements-to-outlines"

    Returns:
        (system_prompt, user_prompt) 或 (None, None)
    """
    prompt_path = os.path.join(PROMPT_DIR, prompt_id)

    system_path = os.path.join(prompt_path, "system.md")
    user_path = os.path.join(prompt_path, "user.md")

    system_prompt = None
    user_prompt = None

    try:
        if os.path.exists(system_path):
            with open(system_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
    except Exception as e:
        logger.warning(f"Failed to load system prompt: {e}")

    try:
        if os.path.exists(user_path):
            with open(user_path, "r", encoding="utf-8") as f:
                user_prompt = f.read()
    except Exception as e:
        logger.warning(f"Failed to load user prompt: {e}")

    return system_prompt, user_prompt


def interpolate_variables(template: str, variables: Dict[str, any]) -> str:
    """
    插值变量 {{variable}} → 实际值

    Args:
        template: 模板文本
        variables: 变量字典（支持str, int, bool等类型）

    Returns:
        插值后的文本
    """
    result = template
    for key, value in variables.items():
        # 将值转换为字符串
        if isinstance(value, bool):
            str_value = str(value)
        elif isinstance(value, (int, float)):
            str_value = str(value)
        elif value is None:
            str_value = ''
        else:
            str_value = str(value)
        result = result.replace(f"{{{{{key}}}}}", str_value)
    return result


def build_prompt(
    prompt_id: str,
    variables: Dict[str, str],
    conditions: Optional[Dict[str, bool]] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    构建完整的prompt（加载模板 + 处理snippet + 条件块 + 插值变量）

    处理顺序（与Web端一致）:
    1. process_snippets(template) - 处理 {{snippet:name}}
    2. process_conditional_blocks(template, conditions) - 处理 {{#if condition}}
    3. interpolate_variables(template, variables) - 插值 {{variable}}

    Args:
        prompt_id: Prompt ID
        variables: 变量字典
        conditions: 条件字典（用于条件块处理）

    Returns:
        (system_prompt, user_prompt)
    """
    system_template, user_template = load_prompt(prompt_id)

    # 合并variables作为条件（支持布尔值）
    effective_conditions = conditions or {}
    # 从variables中提取布尔条件
    for key, value in variables.items():
        if isinstance(value, bool):
            effective_conditions[key] = value
        elif isinstance(value, str) and value.lower() in ('true', '1', 'yes'):
            effective_conditions[key] = True
        elif isinstance(value, str) and value.lower() in ('false', '0', 'no', ''):
            effective_conditions[key] = False

    if system_template:
        # 按顺序处理：snippet -> conditional -> interpolate
        system_prompt = process_snippets(system_template)
        system_prompt = process_conditional_blocks(system_prompt, effective_conditions)
        system_prompt = interpolate_variables(system_prompt, variables)
    else:
        system_prompt = None

    if user_template:
        # 按顺序处理：snippet -> conditional -> interpolate
        user_prompt = process_snippets(user_template)
        user_prompt = process_conditional_blocks(user_prompt, effective_conditions)
        user_prompt = interpolate_variables(user_prompt, variables)
    else:
        user_prompt = None

    return system_prompt, user_prompt


# 保留原有的幻灯片内容prompt（向后兼容）
from .slide_content_system import SLIDE_CONTENT_SYSTEM_PROMPT, TEXT_HEIGHT_TABLE

__all__ = [
    'PROMPT_IDS',
    'PROMPT_DIR',
    'SNIPPET_DIR',
    'load_prompt',
    'load_snippet',
    'process_snippets',
    'process_conditional_blocks',
    'interpolate_variables',
    'build_prompt',
    'SLIDE_CONTENT_SYSTEM_PROMPT',
    'TEXT_HEIGHT_TABLE',
]