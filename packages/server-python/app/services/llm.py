"""
LLM 统一接口 - 支持 OpenAI 兼容 API

支持:
- 多Provider调用
- Thinking/Reasoning参数
- 流式和非流式模式
- 场景驱动的模型路由
- 全局限流（多用户并发场景）
"""

import asyncio
import httpx
import json
import logging
import time
import uuid

import os

from typing import Optional, Dict, Any, List
from app.core.config import settings
from app.core.time_utils import utcnow
from app.services.model_router import (
    get_model_router,
    SceneType,
)

logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


def _safe_uuid(user_id: Optional[str]) -> Optional[uuid.UUID]:
    """Safely convert user_id string to UUID, returning None on failure."""
    try:
        return uuid.UUID(user_id) if user_id else None
    except (ValueError, AttributeError):
        return None


# ============================================================================
# 全局限流器 - 多用户并发场景下的 LLM 调用控制
# ============================================================================

class LLMRateLimiter:
    """LLM 全局限流器：并发限制 + 速率限制"""

    def __init__(self, max_concurrent: int = 10, requests_per_minute: int = 60):
        self.max_concurrent = max_concurrent
        self.requests_per_minute = requests_per_minute
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._tokens = requests_per_minute
        self._last_refill = time.time()
        self._lock = asyncio.Lock()
        self._total_requests = 0
        self._rejected_requests = 0

    async def _try_consume_token(self) -> bool:
        """Refill and consume a token in a single lock acquisition to avoid double-lock."""
        async with self._lock:
            now = time.time()
            elapsed = now - self._last_refill
            new_tokens = elapsed * (self.requests_per_minute / 60.0)
            self._tokens = min(self.requests_per_minute, self._tokens + new_tokens)
            self._last_refill = now
            if self._tokens >= 1:
                self._tokens -= 1
                return True
            return False

    async def acquire(self, timeout: float = 30.0) -> bool:
        self._total_requests += 1
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=timeout)
        except asyncio.TimeoutError:
            self._rejected_requests += 1
            logger.warning(f"[RateLimiter] 并发等待超时")
            return False

        start_wait = time.time()
        while not await self._try_consume_token():
            if time.time() - start_wait > timeout:
                self._semaphore.release()
                self._rejected_requests += 1
                logger.warning(f"[RateLimiter] 速率等待超时")
                return False
            await asyncio.sleep(0.1)

        return True

    def release(self):
        self._semaphore.release()

    def get_stats(self) -> Dict[str, int]:
        return {
            "total_requests": self._total_requests,
            "rejected_requests": self._rejected_requests,
            "current_tokens": int(self._tokens),
            "max_concurrent": self.max_concurrent,
            "requests_per_minute": self.requests_per_minute,
        }


# 全局限流器实例
_rate_limiter = LLMRateLimiter(max_concurrent=10, requests_per_minute=60)


# ============================================================================
# 原有代码
# ============================================================================

PROVIDER_MODEL_MAP = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-20241022",
    "deepseek": "deepseek-chat",
}

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
    provider_id = "openai"
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


async def _call_llm_internal(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    max_retries: int = 3,
    thinking_config: Optional[Dict[str, Any]] = None,
    scene_type: Optional[SceneType] = None,
    user_id: Optional[str] = None,
    db: Optional[Any] = None,
    usage_callback: Optional[Any] = None,
) -> str:
    """内部 LLM 调用（不含限流）

    Args:
        usage_callback: 可选的异步回调，签名为 async callback(usage_data: dict) -> None
                        用于记录 LLM 使用量，替代直接传入 db 参数。
                        当 usage_callback 存在时优先使用，db 参数保留向后兼容。
    """
    start_time = time.time()
    call_start = time.time()

    if scene_type and not model:
        router = get_model_router()
        model = router.get_model_for_scene(scene_type)
        logger.info(f"[LLM] 场景 {scene_type.value} 选择模型: {model}")

    model_str = model or settings.DEFAULT_MODEL
    provider_id, model_id = parse_model_string(model_str)

    if model_id in MODEL_REMAP:
        original_model = model_id
        model_id = MODEL_REMAP[model_id]
        provider_id = "qwen"
        logger.info(f"[LLM] 模型映射: {original_model} -> {model_id}")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    payload = {"model": model_id, "messages": messages, "temperature": temperature}
    if max_tokens:
        payload["max_tokens"] = max_tokens

    if thinking_config:
        try:
            from app.services.model_metadata import build_thinking_params
            thinking_params = build_thinking_params(provider_id, model_id, thinking_config)
            if thinking_params:
                payload.update(thinking_params)
                logger.info(f"[LLM] Thinking参数: {thinking_params}")
        except ImportError:
            logger.warning("[LLM] model_metadata not available")

    url = f"{api_base}/chat/completions"
    logger.info(f"[LLM] 开始调用 - provider={provider_id}, model={model_id}")

    effective_max_retries = max_retries * 2

    for attempt in range(effective_max_retries):
        attempt_start = time.time()
        try:
            logger.info(f"[LLM] 尝试 #{attempt + 1}/{effective_max_retries}")

            def sync_call():
                import requests
                from urllib3.exceptions import InsecureRequestWarning
                # DASHSCOPE_VERIFY_SSL: 默认启用SSL验证；仅在特殊网络环境下设为False禁用
                verify_ssl = os.environ.get("DASHSCOPE_VERIFY_SSL", "true").lower() not in ("false", "0", "no")
                if not verify_ssl:
                    requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
                session = requests.Session()
                resp = session.post(
                    url,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=(30, 120),
                    verify=verify_ssl,
                )
                resp.raise_for_status()
                return resp.json()

            result = await asyncio.to_thread(sync_call)

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
            logger.info(f"[LLM] 调用成功 (耗时: {elapsed:.1f}s, 总耗时: {total_elapsed:.1f}s)")

            # 记录 LLM 使用量和成本（非阻塞，失败不影响主流程）
            try:
                usage = result.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
                duration_ms = int((time.time() - call_start) * 1000)

                # 构建使用量数据
                usage_data = {
                    "user_id": user_id,
                    "provider": provider_id,
                    "model": model_id,
                    "scene_type": scene_type.value if scene_type else None,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "duration_ms": duration_ms,
                    "status": "success",
                }

                # 优先使用回调模式
                if usage_callback:
                    await usage_callback(usage_data)
                elif db:
                    # 向后兼容：直接写数据库
                    cost_yuan = 0.0
                    input_price = 0.0
                    output_price = 0.0
                    price_row = await db.fetchrow(
                        "SELECT input_price_per_1k, output_price_per_1k FROM llm_configs WHERE provider = $1 AND model = $2 LIMIT 1",
                        provider_id, model_id
                    )
                    if price_row:
                        input_price = price_row["input_price_per_1k"] or 0
                        output_price = price_row["output_price_per_1k"] or 0
                        cost_yuan = (prompt_tokens / 1000) * input_price + (completion_tokens / 1000) * output_price

                    await db.execute(
                        """
                        INSERT INTO llm_usage_logs
                            (user_id, provider, model, scene_type,
                             prompt_tokens, completion_tokens, total_tokens,
                             cost_yuan, input_price_per_1k, output_price_per_1k,
                             status, duration_ms, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        """,
                        _safe_uuid(user_id),
                        provider_id, model_id,
                        scene_type.value if scene_type else None,
                        prompt_tokens, completion_tokens, total_tokens,
                        round(cost_yuan, 6), input_price, output_price,
                        "success", duration_ms, utcnow()
                    )
            except Exception as e:
                logger.warning(f"[LLM] 使用量记录失败: {e}")

            return content

        except httpx.TimeoutException as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 超时 (尝试 #{attempt + 1}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(2)
            else:
                raise Exception(f"LLM API timeout after {effective_max_retries} retries: {e}")

        except httpx.ConnectError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 连接错误 (尝试 #{attempt + 1}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(3)
            else:
                raise Exception(f"LLM API connection error after {effective_max_retries} retries: {e}")

        except httpx.RemoteProtocolError as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 服务器断开 (尝试 #{attempt + 1}, 耗时: {elapsed:.1f}s): {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(3)
            else:
                raise Exception(f"LLM API server disconnected after {effective_max_retries} retries: {e}")

        except httpx.HTTPStatusError as e:
            logger.error(f"[LLM] HTTP错误: {e.response.status_code} - {e.response.text[:500]}")
            raise Exception(f"LLM API error: {e.response.status_code}")

        except Exception as e:
            elapsed = time.time() - attempt_start
            logger.warning(f"[LLM] 未预期错误 (尝试 #{attempt + 1}): {type(e).__name__}: {e}")
            if attempt < effective_max_retries - 1:
                await asyncio.sleep(2)
            else:
                # 记录失败的 LLM 调用
                try:
                    duration_ms = int((time.time() - call_start) * 1000)
                    if usage_callback:
                        await usage_callback({
                            "user_id": user_id,
                            "provider": provider_id,
                            "model": model_id,
                            "scene_type": scene_type.value if scene_type else None,
                            "prompt_tokens": 0,
                            "completion_tokens": 0,
                            "total_tokens": 0,
                            "duration_ms": duration_ms,
                            "status": "error",
                        })
                    elif db:
                        await db.execute(
                            """
                            INSERT INTO llm_usage_logs
                                (user_id, provider, model, scene_type, cost_yuan, status, error_message, duration_ms, created_at)
                            VALUES ($1, $2, $3, $4, 0, 'error', $5, $6, $7)
                            """,
                            _safe_uuid(user_id),
                            provider_id, model_id,
                            scene_type.value if scene_type else None,
                            str(e)[:500], duration_ms, utcnow()
                        )
                except Exception:
                    pass
                raise


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
    user_id: Optional[str] = None,
    db: Optional[Any] = None,
    usage_callback: Optional[Any] = None,
) -> str:
    """调用 LLM（带全局限流）"""
    acquired = await _rate_limiter.acquire(timeout=30.0)
    if not acquired:
        raise Exception(f"LLM rate limit exceeded. Stats: {_rate_limiter.get_stats()}")

    try:
        return await _call_llm_internal(
            prompt, system_prompt, model, temperature, max_tokens, max_retries, thinking_config, scene_type, user_id, db, usage_callback
        )
    finally:
        _rate_limiter.release()


async def _stream_llm_internal(
    prompt: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    max_retries: int = 3,
    thinking_config: Optional[Dict[str, Any]] = None,
    scene_type: Optional[SceneType] = None,
):
    """内部流式调用（不含限流）"""
    if scene_type and not model:
        router = get_model_router()
        model = router.get_model_for_scene(scene_type)
        logger.info(f"[LLM Stream] 场景 {scene_type.value} 选择模型: {model}")

    model_str = model or settings.DEFAULT_MODEL
    provider_id, model_id = parse_model_string(model_str)

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

    payload = {"model": model_id, "messages": messages, "temperature": temperature, "stream": True}
    if max_tokens:
        payload["max_tokens"] = max_tokens

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
                async with client.stream("POST", url, headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }, json=payload) as response:
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
                logger.warning("Stream failed, falling back to non-stream")
                result = await _call_llm_internal(prompt, system_prompt, model, temperature, max_tokens, max_retries=1)
                yield result
                return


# 流式调用专用信号量（与全局限流器共享并发预算，避免叠加超限）
_stream_semaphore = asyncio.Semaphore(6)


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
    """流式调用 LLM（带并发控制，防止过多流式连接导致 API 限流）"""
    acquired = False
    try:
        await asyncio.wait_for(_stream_semaphore.acquire(), timeout=60.0)
        acquired = True
        async for chunk in _stream_llm_internal(
            prompt, system_prompt, model, temperature, max_tokens, max_retries, thinking_config, scene_type
        ):
            yield chunk
    finally:
        if acquired:
            _stream_semaphore.release()


async def call_llm_with_vision(
    prompt: str,
    images: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    max_retries: int = 3,
    scene_type: Optional[SceneType] = None,
) -> str:
    """调用视觉模型（多模态）"""
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

    if model_str in MODEL_REMAP:
        original_model = model_str
        model_str = "qwen-vl-max" if "gpt-4" in model_str or "claude" in model_str else MODEL_REMAP[model_str]
        logger.info(f"[LLM Vision] 模型映射: {original_model} -> {model_str}")

    content = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({"type": "image_url", "image_url": {"url": img.get("url")}})

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": content})

    api_base = settings.OPENAI_API_BASE or "https://api.openai.com/v1"
    api_key = settings.OPENAI_API_KEY

    url = f"{api_base}/chat/completions"
    payload = {"model": model_str, "messages": messages}

    timeout = httpx.Timeout(120.0, connect=30.0)

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
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
            logger.error(f"Vision API HTTP error: {e.response.status_code}")
            raise Exception(f"Vision API error: {e.response.status_code}")

        except Exception as e:
            logger.warning(f"Vision API unexpected error (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                raise