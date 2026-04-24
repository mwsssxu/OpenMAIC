"""
TTS (Text-to-Speech) 服务

支持多个 TTS provider：
- OpenAI TTS
- MiniMax TTS
- Azure TTS (可选)

返回 base64 编码的音频数据
"""

import aiohttp
import base64
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# 全局共享的 ClientSession，避免每次请求创建新 session
_tts_session: Optional[aiohttp.ClientSession] = None


async def get_tts_session() -> aiohttp.ClientSession:
    """获取共享的 aiohttp ClientSession"""
    if _tts_session is None or _tts_session.closed:
        _tts_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=60),
            connector=aiohttp.TCPConnector(limit=10)
        )
    return _tts_session


async def close_tts_session():
    """关闭共享的 ClientSession（应用关闭时调用）"""
    if _tts_session and not _tts_session.closed:
        await _tts_session.close()
        _tts_session = None


async def generate_tts(
    text: str,
    provider: str = "openai",
    voice: str = "alloy",
    speed: float = 1.0,
    model: str = "tts-1",
) -> dict:
    """
    生成 TTS 音频

    Args:
        text: 要转换的文本
        provider: TTS provider (openai, minimax, azure)
        voice: 语音 ID
        speed: 语速 (0.25-4.0)
        model: TTS 模型

    Returns:
        {"audio": bytes, "format": str}
    """
    if provider == "openai":
        return await _generate_openai_tts(text, voice, speed, model)
    elif provider == "minimax":
        return await _generate_minimax_tts(text, voice, speed)
    else:
        # 默认使用 OpenAI
        return await _generate_openai_tts(text, voice, speed, model)


async def _generate_openai_tts(
    text: str,
    voice: str = "alloy",
    speed: float = 1.0,
    model: str = "tts-1",
) -> dict:
    """
    OpenAI TTS API

    Voices: alloy, echo, fable, onyx, nova, shimmer
    Models: tts-1 (fast), tts-1-hd (high quality)
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("OpenAI API key not configured")

    url = "https://api.openai.com/v1/audio/speech"

    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "speed": speed,
        "response_format": "mp3",
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        session = await get_tts_session()
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                logger.error(f"OpenAI TTS error: {resp.status} - {error_text}")
                raise Exception(f"OpenAI TTS API error: {resp.status}")

            # 成功时读取音频数据
            audio_data = await resp.read()
            return {
                "audio": audio_data,
                "format": "mp3",
            }
    except Exception as e:
        logger.error(f"OpenAI TTS failed: {e}")
        raise


async def _generate_minimax_tts(
    text: str,
    voice: str = "male-qn-qingse",
    speed: float = 1.0,
) -> dict:
    """
    MiniMax TTS API

    Voices: male-qn-qingse, female-shaonv, male-qn-jingying, etc.
    """
    api_key = settings.MINIMAX_API_KEY
    base_url = settings.MINIMAX_BASE_URL or "https://api.minimaxi.com"

    if not api_key:
        raise ValueError("MiniMax API key not configured")

    url = f"{base_url}/text_to_speech"

    payload = {
        "text": text,
        "voice_id": voice,
        "speed": speed,
        "model": "speech-01",
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        session = await get_tts_session()
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                logger.error(f"MiniMax TTS error: {resp.status} - {error_text}")
                raise Exception(f"MiniMax TTS API error: {resp.status}")

            # MiniMax 返回 JSON，包含 base64 音频
            result = await resp.json()

            if "data" in result and "audio" in result["data"]:
                audio_base64 = result["data"]["audio"]
                audio_data = base64.b64decode(audio_base64)
                return {
                    "audio": audio_data,
                    "format": "mp3",
                }
            else:
                raise Exception("MiniMax TTS response format error")
    except Exception as e:
        logger.error(f"MiniMax TTS failed: {e}")
        raise


def encode_audio_base64(audio_data: bytes) -> str:
    """将音频数据编码为 base64"""
    return base64.b64encode(audio_data).decode("utf-8")