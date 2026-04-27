"""
TTS (Text-to-Speech) 服务

支持多个 TTS provider：
- Qwen TTS (阿里云百炼 DashScope)
- MiniMax TTS
- OpenAI TTS

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
    global _tts_session
    if _tts_session is None or _tts_session.closed:
        _tts_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=120),
            connector=aiohttp.TCPConnector(limit=10)
        )
    return _tts_session


async def close_tts_session():
    """关闭共享的 ClientSession（应用关闭时调用）"""
    global _tts_session
    if _tts_session and not _tts_session.closed:
        await _tts_session.close()
        _tts_session = None


async def generate_tts(
    text: str,
    provider: str = "qwen",
    voice: str = "Cherry",
    speed: float = 1.0,
    model: str = "qwen3-tts-flash",
) -> dict:
    """
    生成 TTS 音频

    Args:
        text: 要转换的文本
        provider: TTS provider (qwen, minimax, openai)
        voice: 语音 ID
        speed: 语速 (0.5-2.0)
        model: TTS 模型

    Returns:
        {"audio": bytes, "format": str}
    """
    if provider == "qwen":
        return await _generate_qwen_tts(text, voice, speed, model)
    elif provider == "minimax":
        return await _generate_minimax_tts(text, voice, speed)
    elif provider == "openai":
        return await _generate_openai_tts(text, voice, speed, model)
    else:
        # 默认使用 Qwen TTS
        return await _generate_qwen_tts(text, voice, speed, model)


async def _generate_qwen_tts(
    text: str,
    voice: str = "Cherry",
    speed: float = 1.0,
    model: str = "qwen3-tts-flash",
) -> dict:
    """
    Qwen TTS (阿里云百炼 DashScope) API

    Voices: Cherry, Serena, Ethan, Chelsie, Momo, Vivian, Moon, Maia, Kai, Nofish, Bella, Jennifer, Ryan, Katerina, Aiden, Eldric Sage, Mia, Mochi, Bellona, Vincent, Bunny, Neil, Elias, Arthur, Nini, Ebona, Seren, Pip, Stella 等
    Models: qwen3-tts-flash, qwen3-tts-instruct-flash, qwen-tts
    """
    api_key = settings.TTS_API_KEY or settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("TTS API key not configured")

    # DashScope TTS endpoint
    base_url = settings.TTS_API_BASE or "https://dashscope.aliyuncs.com/api/v1"
    url = f"{base_url}/services/aigc/multimodal-generation/generation"

    # Qwen TTS rate 参数范围: -500 到 500
    # speed 1.0 = rate 0, speed 2.0 = rate 500, speed 0.5 = rate -250
    rate = int((speed - 1.0) * 500)

    payload = {
        "model": model,
        "input": {
            "text": text,
            "voice": voice,
            "language_type": "Chinese",
        },
        "parameters": {
            "rate": rate,
        },
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
                logger.error(f"Qwen TTS error: {resp.status} - {error_text}")
                raise Exception(f"Qwen TTS API error: {resp.status}")

            data = await resp.json()

            # 检查响应中的音频 URL
            if not data.get("output", {}).get("audio", {}).get("url"):
                logger.error(f"Qwen TTS: No audio URL in response: {data}")
                raise Exception("Qwen TTS: No audio URL in response")

            # 下载音频文件
            audio_url = data["output"]["audio"]["url"]
            async with session.get(audio_url) as audio_resp:
                if audio_resp.status != 200:
                    raise Exception(f"Failed to download audio: {audio_resp.status}")

                audio_data = await audio_resp.read()

            return {
                "audio": audio_data,
                "format": "wav",
            }
    except Exception as e:
        logger.error(f"Qwen TTS failed: {e}")
        raise


async def _generate_openai_tts(
    text: str,
    voice: str = "alloy",
    speed: float = 1.0,
    model: str = "tts-1",
) -> dict:
    """
    OpenAI TTS API (fallback)

    Voices: alloy, echo, fable, onyx, nova, shimmer
    Models: tts-1 (fast), tts-1-hd (high quality)
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("OpenAI API key not configured")

    base_url = settings.OPENAI_API_BASE or "https://api.openai.com"
    url = f"{base_url}/audio/speech"

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
    voice: str = "female-yujie",
    speed: float = 1.0,
) -> dict:
    """
    MiniMax TTS API

    Voices: female-yujie, male-qn-jingying, female-shaonv, Chinese (Mandarin)_Gentleman 等
    """
    api_key = settings.MINIMAX_API_KEY
    base_url = settings.MINIMAX_BASE_URL or "https://api.minimaxi.com"

    if not api_key:
        raise ValueError("MiniMax API key not configured")

    url = f"{base_url}/v1/t2a_v2"

    payload = {
        "model": "speech-2.8-hd",
        "text": text,
        "stream": False,
        "output_format": "hex",
        "voice_setting": {
            "voice_id": voice,
            "speed": speed,
            "vol": 1,
            "pitch": 0,
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
        "language_boost": "auto",
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

            data = await resp.json()
            hex_audio = data.get("data", {}).get("audio")

            if not hex_audio or not isinstance(hex_audio, str):
                raise Exception("MiniMax TTS response format error")

            # 将 hex 转换为 bytes
            audio_data = bytes.fromhex(hex_audio.strip())
            return {
                "audio": audio_data,
                "format": "mp3",
            }
    except Exception as e:
        logger.error(f"MiniMax TTS failed: {e}")
        raise


def encode_audio_base64(audio_data: bytes) -> str:
    """将音频数据编码为 base64"""
    return base64.b64encode(audio_data).decode("utf-8")