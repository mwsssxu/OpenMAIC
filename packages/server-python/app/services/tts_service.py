"""
TTS (Text-to-Speech) 服务

支持多个 TTS provider：
- Qwen TTS (阿里云百炼 DashScope) - 使用官方 SDK
- MiniMax TTS
- OpenAI TTS

返回 base64 编码的音频数据
"""

import asyncio
import base64
import logging
import random
from typing import Optional
import dashscope
from dashscope.audio.tts.speech_synthesizer import SpeechSynthesizer
import aiohttp
from app.core.config import settings

logger = logging.getLogger(__name__)

# 全局共享的 ClientSession，避免每次请求创建新 session
_tts_session: Optional[aiohttp.ClientSession] = None

# DashScope CosyVoice 可用音色列表（用于随机分配）
COSYVOICE_VOICES = [
    "longxiaochun",   # 芊悦 - 甜美女声
    "longxiaoxia",    # 苏瑶 - 柔美女声
    "longwanlong",    # 晨煦 - 沉稳男声
    "longyixuan",     # 逸轩 - 温柔男声
    "longshuo",       # 烁 - 活力男声
    "longzhiqi",      # 知琪 - 清亮女声
    "longteng",       # 腾 - 热情男声
]

# DashScope Sambert 可用音色列表（用于随机分配）
SAMBERT_VOICES = [
    "zhichu",         # 知楚 - 知性女声
    "zhitian",        # 知甜 - 甜美女声
    "zhiyan",         # 知燕 - 温柔女声
    "zhida",          # 知达 - 沉稳男声
    "zhiyuan",        # 知远 - 深沉男声
]

# DashScope TTS 模型映射
DASHSCOPE_MODELS = {
    "qwen3-tts-flash": "cosyvoice-v2",
    "qwen-tts": "cosyvoice-v1",
    "sambert": "sambert-zhichu-v1",
}


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
    voice: str = None,  # 默认随机分配
    speed: float = 1.0,
    model: str = "qwen3-tts-flash",
) -> dict:
    """
    生成 TTS 音频

    Args:
        text: 要转换的文本
        provider: TTS provider (qwen, minimax, openai)
        voice: 语音 ID（默认随机分配）
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
    voice: str = None,
    speed: float = 1.0,
    model: str = "qwen3-tts-flash",
) -> dict:
    """
    Qwen TTS (阿里云百炼 DashScope) - 使用官方 Python SDK
    当 CosyVoice 失败时自动降级到 Sambert

    Args:
        text: 要转换的文本
        voice: 语音 ID（默认随机分配）
        speed: 语速 (0.5-2.0)
        model: TTS 模型 (qwen3-tts-flash, cosyvoice-v2, sambert-zhichu-v1)

    Returns:
        {"audio": bytes, "format": str, "voice": str}
    """
    # 优先使用 TTS 专用配置，否则使用通用 LLM 配置
    api_key = settings.TTS_API_KEY or settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("TTS API key not configured")

    # 设置 DashScope API key
    dashscope.api_key = api_key

    # 映射模型名称
    actual_model = DASHSCOPE_MODELS.get(model, model)

    # 随机分配音色（如果未指定）
    if voice is None:
        if actual_model.startswith("cosyvoice"):
            voice = random.choice(COSYVOICE_VOICES)
        else:
            voice = random.choice(SAMBERT_VOICES)
        logger.info(f"[TTS] Random voice assigned: {voice}")

    # 根据模型类型选择不同的调用方式
    if actual_model.startswith("cosyvoice"):
        # CosyVoice 模型（使用 tts_v2）
        from dashscope.audio.tts_v2.speech_synthesizer import SpeechSynthesizer as CosyVoiceSynthesizer

        logger.info(f"[TTS] Generating audio - model={actual_model}, voice={voice}, text_len={len(text)}")

        try:
            loop = asyncio.get_event_loop()
            synthesizer = await loop.run_in_executor(
                None,
                lambda: CosyVoiceSynthesizer(
                    model=actual_model,
                    voice=voice,
                )
            )

            audio_data = await loop.run_in_executor(
                None,
                lambda: synthesizer.call(text)
            )

            if audio_data:
                logger.info(f"[TTS] CosyVoice success - size={len(audio_data)} bytes, voice={voice}")
                return {
                    "audio": audio_data,
                    "format": "wav",
                    "voice": voice,
                }
            else:
                logger.warning(f"[TTS] CosyVoice returned no audio, falling back to Sambert")
        except Exception as e:
            logger.warning(f"[TTS] CosyVoice failed: {e}, falling back to Sambert")

        # CosyVoice 失败，降级到 Sambert
        fallback_voice = random.choice(SAMBERT_VOICES)
        logger.info(f"[TTS] Fallback to Sambert with voice={fallback_voice}")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: SpeechSynthesizer.call(
                model="sambert-zhichu-v1",
                text=text,
                format="wav",
                rate=speed,
            )
        )

        audio_data = result.get_audio_data()
        if not audio_data:
            response = result.get_response()
            error_msg = response.get("message", "Unknown error")
            logger.error(f"[TTS] Sambert fallback failed: {error_msg}")
            raise Exception(f"TTS failed: {error_msg}")

        logger.info(f"[TTS] Sambert fallback success - size={len(audio_data)} bytes, voice={fallback_voice}")
        return {
            "audio": audio_data,
            "format": "wav",
            "voice": fallback_voice,
        }
    else:
        # Sambert 模型（使用 tts）
        logger.info(f"[TTS] Generating audio with Sambert - model={actual_model}, voice={voice}")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: SpeechSynthesizer.call(
                model=actual_model,
                text=text,
                format="wav",
                rate=speed,
            )
        )

        audio_data = result.get_audio_data()
        if not audio_data:
            response = result.get_response()
            error_msg = response.get("message", "Unknown error")
            logger.error(f"[TTS] Sambert failed: {error_msg}")
            raise Exception(f"Sambert TTS failed: {error_msg}")

        logger.info(f"[TTS] Audio generated successfully - size={len(audio_data)} bytes, voice={voice}")
        return {
            "audio": audio_data,
            "format": "wav",
            "voice": voice,
        }


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