"""
TTS API 路由 - 生成语音音频

POST /tts
请求体: {
  "text": "要转换的文本",
  "provider": "qwen",  // qwen, openai, minimax
  "voice": "Cherry",   // 语音 ID
  "speed": 1.0,        // 语速
  "model": "qwen3-tts-flash"  // 模型 ID
}

返回: {
  "success": true,
  "audioId": "tts_xxx",
  "base64": "...",  // base64 编码的音频
  "format": "wav"   // 音频格式
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.tts_service import generate_tts, encode_audio_base64
import uuid
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    text: str
    provider: Optional[str] = "qwen"
    voice: Optional[str] = None  # 默认随机分配
    speed: Optional[float] = 1.0
    model: Optional[str] = "qwen3-tts-flash"  # DashScope CosyVoice 模型
    audioId: Optional[str] = None


@router.post("")
async def generate_tts_audio(request: TTSRequest):
    """
    生成 TTS 音频并返回 base64 编码
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="Missing required field: text")

    # 生成 audio ID
    audio_id = request.audioId or f"tts_{uuid.uuid4()}"

    try:
        # 生成 TTS 音频（音色随机分配）
        result = await generate_tts(
            text=request.text,
            provider=request.provider or "qwen",
            voice=request.voice,  # None 表示随机分配
            speed=request.speed or 1.0,
            model=request.model or "qwen3-tts-flash",
        )

        # 转 base64
        base64_audio = encode_audio_base64(result["audio"])

        # 获取实际使用的音色
        actual_voice = result.get("voice", request.voice or "random")

        logger.info(f"[TTS API] Generated audio: {audio_id}, format: {result['format']}, voice: {actual_voice}, size: {len(result['audio'])} bytes")

        return {
            "success": True,
            "audioId": audio_id,
            "base64": base64_audio,
            "format": result["format"],
            "voice": actual_voice,  # 返回实际使用的音色
        }
    except Exception as e:
        logger.error(f"[TTS API] Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices")
async def get_available_voices():
    """
    获取可用的 TTS 语音列表
    """
    voices = {
        "qwen": [
            # CosyVoice 音色（qwen3-tts-flash 模型）
            {"id": "longxiaochun", "name": "芊悦 (女)", "language": "zh-CN", "gender": "female", "model": "cosyvoice-v2"},
            {"id": "longxiaoxia", "name": "苏瑶 (女)", "language": "zh-CN", "gender": "female", "model": "cosyvoice-v2"},
            {"id": "longwanlong", "name": "晨煦 (男)", "language": "zh-CN", "gender": "male", "model": "cosyvoice-v2"},
            {"id": "longyixuan", "name": "逸轩 (男)", "language": "zh-CN", "gender": "male", "model": "cosyvoice-v2"},
            {"id": "longshuo", "name": "烁 (男)", "language": "zh-CN", "gender": "male", "model": "cosyvoice-v2"},
            {"id": "longzhiqi", "name": "知琪 (女)", "language": "zh-CN", "gender": "female", "model": "cosyvoice-v2"},
            {"id": "longteng", "name": "腾 (男)", "language": "zh-CN", "gender": "male", "model": "cosyvoice-v2"},
            # Sambert 音色（备用）
            {"id": "zhichu", "name": "知楚 (女)", "language": "zh-CN", "gender": "female", "model": "sambert-zhichu-v1"},
            {"id": "zhitian", "name": "知甜 (女)", "language": "zh-CN", "gender": "female", "model": "sambert-zhitian-v1"},
            {"id": "zhiyan", "name": "知燕 (女)", "language": "zh-CN", "gender": "female", "model": "sambert-zhiyan-v1"},
            {"id": "zhida", "name": "知达 (男)", "language": "zh-CN", "gender": "male", "model": "sambert-zhida-v1"},
        ],
        "openai": [
            {"id": "alloy", "name": "Alloy", "language": "en", "gender": "neutral"},
            {"id": "echo", "name": "Echo", "language": "en", "gender": "male"},
            {"id": "fable", "name": "Fable", "language": "en", "gender": "neutral"},
            {"id": "onyx", "name": "Onyx", "language": "en", "gender": "male"},
            {"id": "nova", "name": "Nova", "language": "en", "gender": "female"},
            {"id": "shimmer", "name": "Shimmer", "language": "en", "gender": "female"},
        ],
        "minimax": [
            {"id": "female-yujie", "name": "御姐音色", "language": "zh-CN", "gender": "female"},
            {"id": "male-qn-jingying", "name": "精英青年", "language": "zh-CN", "gender": "male"},
            {"id": "female-shaonv", "name": "少女音色", "language": "zh-CN", "gender": "female"},
            {"id": "Chinese (Mandarin)_Gentleman", "name": "温润男声", "language": "zh-CN", "gender": "male"},
            {"id": "Chinese (Mandarin)_News_Anchor", "name": "新闻女声", "language": "zh-CN", "gender": "female"},
        ],
    }

    return {"success": True, "voices": voices}