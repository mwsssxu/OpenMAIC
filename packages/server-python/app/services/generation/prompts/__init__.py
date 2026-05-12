"""
Prompt Templates - 与Web端一致的prompt管理系统

功能：
- 基于文件的prompt存储
- 变量插值 {{variable}}
- 支持多场景类型配置
"""

import os
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

PROMPT_DIR = os.path.join(os.path.dirname(__file__), "templates")

PROMPT_IDS = {
    "REQUIREMENTS_TO_OUTLINES": "requirements-to-outlines",
    "SLIDE_CONTENT": "slide-content",
    "SLIDE_ACTIONS": "slide-actions",
    "QUIZ_CONTENT": "quiz-content",
    "QUIZ_ACTIONS": "quiz-actions",
    "INTERACTIVE_CONTENT": "interactive-content",
    "INTERACTIVE_ACTIONS": "interactive-actions",
    "PBL_ACTIONS": "pbl-actions",
}


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


def interpolate_variables(template: str, variables: Dict[str, str]) -> str:
    """
    插值变量 {{variable}} → 实际值

    Args:
        template: 模板文本
        variables: 变量字典

    Returns:
        插值后的文本
    """
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    return result


def build_prompt(prompt_id: str, variables: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
    """
    构建完整的prompt（加载模板 + 插值变量）

    Args:
        prompt_id: Prompt ID
        variables: 变量字典

    Returns:
        (system_prompt, user_prompt)
    """
    system_template, user_template = load_prompt(prompt_id)

    if system_template:
        system_prompt = interpolate_variables(system_template, variables)
    else:
        system_prompt = None

    if user_template:
        user_prompt = interpolate_variables(user_template, variables)
    else:
        user_prompt = None

    return system_prompt, user_prompt


# 保留原有的幻灯片内容prompt（向后兼容）
from .slide_content_system import SLIDE_CONTENT_SYSTEM_PROMPT, TEXT_HEIGHT_TABLE

__all__ = [
    'PROMPT_IDS',
    'load_prompt',
    'interpolate_variables',
    'build_prompt',
    'SLIDE_CONTENT_SYSTEM_PROMPT',
    'TEXT_HEIGHT_TABLE',
]