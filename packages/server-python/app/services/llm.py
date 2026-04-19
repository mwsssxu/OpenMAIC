"""
LiteLLM 统一接口 - 支持 100+ LLM 提供商
"""

import os
from litellm import completion
from typing import Optional, Dict, Any, List
from app.core.config import settings

# 提供商映射
PROVIDER_MODEL_MAP = {
    "openai": "openai/gpt-4o",
    "anthropic": "anthropic/claude-3-5-sonnet-20241022",
    "google": "gemini/gemini-1.5-pro",
    "deepseek": "deepseek/deepseek-chat",
    "minimax": "minimax/MiniMax-M2.7-highspeed",
    "ollama": "ollama/llama3",
}


async def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    stream: bool = False,
) -> str:
    """
    调用 LLM（统一接口）

    Args:
        prompt: 用户输入
        system_prompt: 系统提示词
        model: 模型名称（如 openai:gpt-4o）
        temperature: 温度参数
        max_tokens: 最大输出 tokens
        stream: 是否流式输出

    Returns:
        LLM 响应文本
    """
    model_str = model or settings.DEFAULT_MODEL

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    # LiteLLM 自动处理 API Key
    response = await completion(
        model=model_str,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream,
    )

    if stream:
        # 流式返回需要特殊处理
        return response
    else:
        return response.choices[0].message.content


async def stream_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
):
    """
    流式调用 LLM

    Yields:
        文本 chunk
    """
    model_str = model or settings.DEFAULT_MODEL

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = await completion(
        model=model_str,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )

    for chunk in response:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def call_llm_with_vision(
    prompt: str,
    images: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """
    调用视觉模型（多模态）

    Args:
        prompt: 文本输入
        images: 图片列表 [{type: "image_url", image_url: {url: "..."}}]
        system_prompt: 系统提示词
        model: 模型名称
    """
    model_str = model or settings.DEFAULT_MODEL

    # 构建多模态消息
    content = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": img.get("url")}
        })

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": content})

    response = await completion(
        model=model_str,
        messages=messages,
    )

    return response.choices[0].message.content