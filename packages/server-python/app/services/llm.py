"""
LLM 统一接口 - 支持 OpenAI 兼容 API
"""

import asyncio
import httpx
import json
import logging
import time

from typing import Optional, Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)
# 禁用 httpx 详细日志，避免泄露敏感信息
logging.getLogger("httpx").setLevel(logging.WARNING)

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
    max_retries: int = 3,
) -> str:
    """
    调用 LLM（使用 httpx，支持重试）
    """
    import time
    start_time = time.time()

    model_str = model or settings.DEFAULT_MODEL
    # 移除 provider 前缀 (支持 openai/ 和 openai: 两种格式)
    if model_str.startswith("openai/"):
        model_str = model_str[7:]
    elif model_str.startswith("openai:"):
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

    url = f"{api_base}/chat/completions"

    logger.info(f"[LLM] 开始调用 - model={model_str}, api_base={api_base}, max_tokens={max_tokens}")
    logger.debug(f"[LLM] prompt长度: {len(prompt)}, system_prompt长度: {len(system_prompt) if system_prompt else 0}")

    # 使用 httpx，简化超时配置
    timeout = httpx.Timeout(300.0, connect=30.0)

    # 配置代理（如果设置）
    proxies = None
    if settings.HTTP_PROXY:
        proxies = {"http://": settings.HTTP_PROXY, "https://": settings.HTTP_PROXY}
        logger.info(f"[LLM] 使用代理: {settings.HTTP_PROXY}")

    for attempt in range(max_retries):
        attempt_start = time.time()
        try:
            logger.info(f"[LLM] 尝试 #{attempt + 1}/{max_retries}")

            # 使用同步客户端（通过 asyncio.to_thread 包装）
            def sync_call():
                with httpx.Client(timeout=timeout, proxies=proxies) as client:
                    resp = client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    resp.raise_for_status()
                    return resp.json()

            result = await asyncio.to_thread(sync_call)
            content = result["choices"][0]["message"]["content"]

            elapsed = time.time() - attempt_start
            total_elapsed = time.time() - start_time
            logger.info(f"[LLM] 调用成功 (本次耗时: {elapsed:.1f}s, 总耗时: {total_elapsed:.1f}s)")
            logger.debug(f"[LLM] 响应长度: {len(content)}")

            return content

        except httpx.TimeoutException as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 超时 (尝试 #{attempt + 1}/{max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终超时 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API timeout after {max_retries} retries: {e}")

        except httpx.ConnectError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 连接错误 (尝试 #{attempt + 1}/{max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终连接错误 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API connection error after {max_retries} retries: {e}")

        except httpx.RemoteProtocolError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 服务器断开连接 (尝试 #{attempt + 1}/{max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终服务器断开 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API server disconnected after {max_retries} retries: {e}")

        except httpx.HTTPStatusError as e:
            elapsed = time.time() - attempt_start
            logger.error(f"[LLM] HTTP错误 (耗时: {elapsed:.1f}s): {e.response.status_code} - {e.response.text}")
            raise Exception(f"LLM API error: {e.response.status_code}")

        except Exception as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 未预期错误 (尝试 #{attempt + 1}/{max_retries}, 耗时: {elapsed:.1f}s): {type(e).__name__}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终失败 (总耗时: {total_elapsed:.1f}s): {e}")
                raise


async def stream_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    max_retries: int = 3,
):
    """
    流式调用 LLM（真正的流式，逐块返回）
    """
    model_str = model or settings.DEFAULT_MODEL
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
        "stream": True,  # 启用流式输出
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    url = f"{api_base}/chat/completions"
    timeout = httpx.Timeout(300.0, connect=30.0)  # 流式需要更长超时

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    response.raise_for_status()

                    buffer = ""
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content:
                                    buffer += content
                                    yield content
                            except json.JSONDecodeError:
                                continue

                    # 如果没有流式内容，返回整个 buffer
                    if not buffer:
                        yield buffer

                    return

        except httpx.TimeoutException as e:
            logger.warning(f"LLM stream timeout (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                raise Exception(f"LLM stream timeout after {max_retries} retries: {e}")

        except httpx.RemoteProtocolError as e:
            logger.warning(f"LLM stream connection closed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)
            else:
                raise Exception(f"LLM stream connection closed after {max_retries} retries: {e}")

        except Exception as e:
            logger.warning(f"LLM stream error (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                # 最后一次失败，使用非流式作为备用
                logger.warning("Stream failed, falling back to non-stream")
                result = await call_llm(prompt, system_prompt, model, temperature, max_tokens, max_retries=1)
                yield result
                return


async def call_llm_with_vision(
    prompt: str,
    images: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    max_retries: int = 3,
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

    url = f"{api_base}/chat/completions"
    payload = {
        "model": model_str,
        "messages": messages,
    }

    timeout = httpx.Timeout(120.0, connect=30.0)

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]

        except httpx.TimeoutException as e:
            logger.warning(f"Vision API timeout (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                raise Exception(f"Vision API timeout after {max_retries} retries: {e}")

        except httpx.RemoteProtocolError as e:
            logger.warning(f"Vision API connection closed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(3)
            else:
                raise Exception(f"Vision API connection closed after {max_retries} retries: {e}")

        except httpx.HTTPStatusError as e:
            logger.error(f"Vision API HTTP error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Vision API error: {e.response.status_code}")

        except Exception as e:
            logger.warning(f"Vision API unexpected error (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                raise