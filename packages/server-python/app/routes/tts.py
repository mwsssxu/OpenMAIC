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
    voice: Optional[str] = "Cherry"
    speed: Optional[float] = 1.0
    model: Optional[str] = "qwen3-tts-flash"
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
        # 生成 TTS 音频
        result = await generate_tts(
            text=request.text,
            provider=request.provider or "qwen",
            voice=request.voice or "Cherry",
            speed=request.speed or 1.0,
            model=request.model or "qwen3-tts-flash",
        )

        # 转 base64
        base64_audio = encode_audio_base64(result["audio"])

        logger.info(f"[TTS API] Generated audio: {audio_id}, format: {result['format']}, size: {len(result['audio'])} bytes")

        return {
            "success": True,
            "audioId": audio_id,
            "base64": base64_audio,
            "format": result["format"],
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
            {"id": "Cherry", "name": "芊悦 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Serena", "name": "苏瑶 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Ethan", "name": "晨煦 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Moon", "name": "月白 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Chelsie", "name": "千雪 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Momo", "name": "茉兔 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Vivian", "name": "十三 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Kai", "name": "凯 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Nofish", "name": "不吃鱼 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Bella", "name": "萌宝 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Ryan", "name": "甜茶 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Aiden", "name": "艾登 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Eldric Sage", "name": "沧明子 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Mia", "name": "乖小妹 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Mochi", "name": "沙小弥 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Arthur", "name": "徐大爷 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Nini", "name": "邻家妹妹 (女)", "language": "zh-CN", "gender": "female"},
            # 方言
            {"id": "Jada", "name": "上海-阿珍 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Dylan", "name": "北京-晓东 (男)", "language": "zh-CN", "gender": "male"},
            {"id": "Sunny", "name": "四川-晴儿 (女)", "language": "zh-CN", "gender": "female"},
            {"id": "Rocky", "name": "粤语-阿强 (男)", "language": "zh-HK", "gender": "male"},
            {"id": "Kiki", "name": "粤语-阿清 (女)", "language": "zh-HK", "gender": "female"},
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