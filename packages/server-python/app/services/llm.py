"""
LLM 统一接口 - 支持 OpenAI 兼容 API
"""

import asyncio
import urllib.request
import urllib.error
import json
import os

# 强制禁用所有代理
for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']:
    if key in os.environ:
        del os.environ[key]
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'

from typing import Optional, Dict, Any, List
from app.core.config import settings

# 提供商映射
PROVIDER_MODEL_MAP = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
    "deepseek": "deepseek-chat",
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
    调用 LLM（使用 urllib.request）
    """
    model_str = model or settings.DEFAULT_MODEL
    # 移除 openai/ 前缀
    if model_str.startswith("openai/"):
        model_str = model_str[7:]

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    payload = {
        "model": model_str,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    def _sync_call():
        url = f"{api_base}/chat/completions"
        data = json.dumps(payload).encode('utf-8')

        # 创建不使用代理的请求
        handler = urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(handler)

        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

        response = opener.open(req, timeout=60)
        result = json.loads(response.read().decode('utf-8'))
        return result

    result = await asyncio.to_thread(_sync_call)
    return result["choices"][0]["message"]["content"]


async def stream_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
):
    """
    流式调用 LLM（暂不支持，使用非流式）
    """
    result = await call_llm(prompt, system_prompt, model, temperature, max_tokens)
    yield result


async def call_llm_with_vision(
    prompt: str,
    images: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """
    调用视觉模型（多模态）
    """
    model_str = model or settings.DEFAULT_MODEL
    if model_str.startswith("openai/"):
        model_str = model_str[7:]

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

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    def _sync_call():
        url = f"{api_base}/chat/completions"
        data = json.dumps({
            "model": model_str,
            "messages": messages,
        }).encode('utf-8')

        handler = urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(handler)

        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

        response = opener.open(req, timeout=60)
        return json.loads(response.read().decode('utf-8'))

    result = await asyncio.to_thread(_sync_call)
    return result["choices"][0]["message"]["content"]