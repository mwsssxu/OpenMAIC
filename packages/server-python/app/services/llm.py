"""
LLM 统一接口 - 支持 OpenAI 兼容 API

支持:
- 多Provider调用
- Thinking/Reasoning参数
- 流式和非流式模式
- 场景驱动的模型路由
"""

import asyncio
import httpx
import json
import logging
import time

from typing import Optional, Dict, Any, List
from app.core.config import settings
from app.services.model_router import (
    get_model_router,
    SceneType,
)

logger = logging.getLogger(__name__)
# 禁用 httpx 详细日志，避免泄露敏感信息
logging.getLogger("httpx").setLevel(logging.WARNING)

# 提供商映射
PROVIDER_MODEL_MAP = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
    "deepseek": "deepseek-chat",
}

# 模型映射 - 将不支持的模型转换为 DashScope 支持的模型
# DashScope API 支持的模型：qwen-plus, qwen-turbo, qwen-max, qwen3.5-plus, qwen3.6-plus 等
# 注意：Chat 场景应该直接使用 qwen3.6-plus，不经过此映射
MODEL_REMAP = {
    "gpt-4o-mini": "qwen3.6-plus",
    "gpt-4o": "qwen3.6-plus",
    "gpt-4-turbo": "qwen3.6-plus",
    "gpt-4": "qwen3.6-plus",
    "gpt-3.5-turbo": "qwen-plus",
    "claude-3-5-sonnet": "qwen3.6-plus",
    "claude-3-opus": "qwen-max",
}


def parse_model_string(model_str: str) -> tuple:
    """
    解析模型字符串，提取provider和model_id

    Args:
        model_str: 模型字符串，如 "openai:gpt-5.5" 或 "gpt-5.5"

    Returns:
        (provider_id, model_id) tuple
    """
    # 支持多种格式: "openai:gpt-5.5", "openai/gpt-5.5", "gpt-5.5"
    provider_id = "openai"  # 默认provider

    if "/" in model_str:
        parts = model_str.split("/", 1)
        provider_id = parts[0]
        model_id = parts[1]
    elif ":" in model_str:
        parts = model_str.split(":", 1)
        provider_id = parts[0]
        model_id = parts[1]
    else:
        model_id = model_str

    return provider_id, model_id


async def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    stream: bool = False,
    max_retries: int = 3,
    thinking_config: Optional[Dict[str, Any]] = None,
    scene_type: Optional[SceneType] = None,
) -> str:
    """
    调用 LLM（支持Thinking参数和场景路由）

    Args:
        prompt: 用户提示
        system_prompt: 系统提示
        model: 模型字符串 (支持 "provider:model" 格式)
        temperature: 温度参数
        max_tokens: 最大tokens
        stream: 是否流式
        max_retries: 最大重试次数
        thinking_config: Thinking配置 {"enabled": bool, "effort": str, "budget_tokens": int}
        scene_type: 场景类型（用于自动选择模型）

    Returns:
        LLM响应文本
    """
    start_time = time.time()

    # 场景驱动的模型选择
    if scene_type and not model:
        router = get_model_router()
        model = router.get_model_for_scene(scene_type)
        logger.info(f"[LLM] 场景 {scene_type.value} 选择模型: {model}")

    model_str = model or settings.DEFAULT_MODEL

    # 解析provider和model_id
    provider_id, model_id = parse_model_string(model_str)

    # 模型映射 - 转换为 DashScope 支持的模型
    if model_id in MODEL_REMAP:
        original_model = model_id
        model_id = MODEL_REMAP[model_id]
        provider_id = "qwen"  # 映射后使用qwen provider
        logger.info(f"[LLM] 模型映射: {original_model} -> {model_id}")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    # 添加thinking参数（如果配置）
    if thinking_config:
        try:
            from app.services.model_metadata import build_thinking_params
            thinking_params = build_thinking_params(provider_id, model_id, thinking_config)
            if thinking_params:
                payload.update(thinking_params)
                logger.info(f"[LLM] Thinking参数: {thinking_params}")
        except ImportError:
            logger.warning("[LLM] model_metadata not available, skipping thinking params")

    url = f"{api_base}/chat/completions"

    logger.info(f"[LLM] 开始调用 - provider={provider_id}, model={model_id}, api_base={api_base}, max_tokens={max_tokens}")
    logger.debug(f"[LLM] prompt长度: {len(prompt)}, system_prompt长度: {len(system_prompt) if system_prompt else 0}")

    # DashScope API 响应较慢，增加超时时间
    # SSL问题需要增加重试次数
    timeout = httpx.Timeout(120.0, connect=30.0)

    # 代理配置：从 settings 获取（如果配置）
    proxy = settings.HTTP_PROXY if settings.HTTP_PROXY else None
    if proxy:
        logger.info(f"[LLM] 使用代理: {proxy}")
    else:
        logger.debug("[LLM] 直接访问API（无代理）")

    # 增加重试次数处理SSL不稳定
    effective_max_retries = max_retries * 2  # SSL问题需要更多重试

    for attempt in range(effective_max_retries):
        attempt_start = time.time()
        try:
            logger.info(f"[LLM] 尝试 #{attempt + 1}/{effective_max_retries}")

            # 使用 requests 库（更稳定的SSL处理）
            def sync_call():
                import requests
                from urllib3.exceptions import InsecureRequestWarning
                requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
                session = requests.Session()
                resp = session.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=(30, 120),  # connect timeout, read timeout
                    verify=False,  # 临时禁用SSL验证（DashScope SSL兼容性问题）
                )
                resp.raise_for_status()
                return resp.json()

            result = await asyncio.to_thread(sync_call)

            # 安全解析响应
            if "choices" not in result or len(result["choices"]) == 0:
                logger.error(f"[LLM] 响应格式异常: {result}")
                raise Exception("LLM response missing choices")

            choice = result["choices"][0]
            if "message" not in choice or "content" not in choice["message"]:
                logger.error(f"[LLM] 响应缺少content: {choice}")
                raise Exception("LLM response missing content")

            content = choice["message"]["content"]

            elapsed = time.time() - attempt_start
            total_elapsed = time.time() - start_time
            logger.info(f"[LLM] 调用成功 (本次耗时: {elapsed:.1f}s, 总耗时: {total_elapsed:.1f}s)")
            logger.debug(f"[LLM] 响应长度: {len(content)}")

            return content

        except httpx.TimeoutException as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 超时 (尝试 #{attempt + 1}/{effective_max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(2)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终超时 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API timeout after {effective_max_retries} retries: {e}")

        except httpx.ConnectError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 连接错误 (尝试 #{attempt + 1}/{effective_max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(3)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终连接错误 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API connection error after {effective_max_retries} retries: {e}")

        except httpx.RemoteProtocolError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 服务器断开连接 (尝试 #{attempt + 1}/{effective_max_retries}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(3)  # 等待后重试
            else:
                total_elapsed = time.time() - start_time
                logger.error(f"[LLM] 最终服务器断开 (总耗时: {total_elapsed:.1f}s)")
                raise Exception(f"LLM API server disconnected after {effective_max_retries} retries: {e}")

        except httpx.HTTPStatusError as e:
            elapsed = time.time() - attempt_start
            logger.error(f"[LLM] HTTP错误 (耗时: {elapsed:.1f}s): {e.response.status_code} - {e.response.text}")
            raise Exception(f"LLM API error: {e.response.status_code}")

        except Exception as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 未预期错误 (尝试 #{attempt + 1}/{effective_max_retries}, 耗时: {elapsed:.1f}s): {type(e).__name__}: {e}")
            if attempt < effective_max_retries - 1:
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
    thinking_config: Optional[Dict[str, Any]] = None,
    scene_type: Optional[SceneType] = None,
):
    """
    流式调用 LLM（支持Thinking参数和场景路由）

    Args:
        prompt: 用户提示
        system_prompt: 系统提示
        model: 模型字符串
        temperature: 温度参数
        max_tokens: 最大tokens
        max_retries: 最大重试次数
        thinking_config: Thinking配置
        scene_type: 场景类型（用于自动选择模型）

    Yields:
        流式响应的每个chunk
    """
    # 场景驱动的模型选择
    if scene_type and not model:
        router = get_model_router()
        model = router.get_model_for_scene(scene_type)
        logger.info(f"[LLM Stream] 场景 {scene_type.value} 选择模型: {model}")

    model_str = model or settings.DEFAULT_MODEL

    # 解析provider和model_id
    provider_id, model_id = parse_model_string(model_str)

    # 模型映射
    if model_id in MODEL_REMAP:
        original_model = model_id
        model_id = MODEL_REMAP[model_id]
        provider_id = "qwen"
        logger.info(f"[LLM Stream] 模型映射: {original_model} -> {model_id}")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "stream": True,  # 启用流式输出
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    # 添加thinking参数
    if thinking_config:
        try:
            from app.services.model_metadata import build_thinking_params
            thinking_params = build_thinking_params(provider_id, model_id, thinking_config)
            if thinking_params:
                payload.update(thinking_params)
        except ImportError:
            pass

    url = f"{api_base}/chat/completions"
    timeout = httpx.Timeout(600.0, connect=30.0)

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
                                choices = data.get("choices", [])
                                if not choices:
                                    continue
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
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
    scene_type: Optional[SceneType] = None,
) -> str:
    """
    调用视觉模型（多模态）- 支持场景路由

    Args:
        prompt: 用户提示
        images: 图片列表 [{"url": "..."}]
        system_prompt: 系统提示
        model: 模型字符串
        max_retries: 最大重试次数
        scene_type: 场景类型（用于自动选择模型）

    Returns:
        LLM响应文本
    """
    # 场景驱动的模型选择
    router = get_model_router()
    if not model:
        if scene_type:
            model = router.get_model_for_scene(scene_type)
            logger.info(f"[LLM Vision] 场景 {scene_type.value} 选择模型: {model}")
        else:
            model = router.default_vision_model

    model_str = model
    if model_str.startswith("openai/"):
        model_str = model_str[7:]
    elif model_str.startswith("openai:"):
        model_str = model_str[7:]

    # 模型映射 - 转换为 DashScope 支持的模型（视觉模型使用 qwen-vl）
    if model_str in MODEL_REMAP:
        original_model = model_str
        # 视觉模型使用 qwen-vl-max
        model_str = "qwen-vl-max" if "gpt-4" in model_str or "claude" in model_str else MODEL_REMAP[model_str]
        logger.info(f"[LLM Vision] 模型映射: {original_model} -> {model_str}")

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