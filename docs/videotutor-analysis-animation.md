"""
动画视频生成器 - 借鉴 VideoTutor 的 "Generate to Animation" 功能
将静态课程内容转化为动态讲解视频

技术方案：
1. Manim (数学动画库) - Python库，适合编程、数学可视化
2. Remotion (React视频框架) - 前端渲染，适合复杂动画
3. Puppeteer + HTML2Canvas - 网页录制，适合幻灯片转视频
4. HeyGen/D-ID API - AI数字人视频，适合讲解视频

推荐架构：
- 轻量方案：前端Remotion渲染 + 后端提供内容数据
- 企业方案：集成Manim + TTS + 数字人API
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import uuid


class AnimationScene(BaseModel):
    """动画场景定义"""
    id: str
    duration: float  # 秒
    elements: List[Dict]  # 动画元素
    narration: str  # 讲解文本
    transitions: Optional[List[Dict]] = None  # 过渡效果


class AnimationConfig(BaseModel):
    """动画配置"""
    style: str = "modern"  # modern, minimal, hand-drawn
    fps: int = 30
    resolution: str = "1080p"  # 720p, 1080p, 4k
    voice: str = "zh-CN-female-1"  # TTS语音配置
    background_music: Optional[str] = None
    include_subtitles: bool = True


# ============ 1. 幻灯片转动画方案 ============

SLIDE_TO_ANIMATION_PROMPT = """
你是动画设计专家。根据幻灯片内容生成动画脚本。

## 幻灯片内容
{slide_content}

## 动画风格
{style}

## 要求
1. 为每个元素设计入场动画（fadeIn, slideIn, scaleUp 等）
2. 设置元素显示时序（配合讲解进度）
3. 生成讲解文本（自然流畅的口语化内容）
4. 添加过渡效果（场景切换）

输出 JSON 格式：
{
  "scenes": [
    {
      "id": "scene_1",
      "duration": 15,
      "elements": [
        {
          "id": "el_1",
          "type": "text",
          "content": "标题",
          "animation": {
            "type": "fadeIn",
            "duration": 1,
            "delay": 0
          }
        }
      ],
      "narration": "欢迎来到本节课，我们将学习..."
    }
  ]
}
"""


async def generate_animation_script(
    scene_content: Dict[str, Any],
    style: str = "modern",
    model: Optional[str] = None,
) -> List[AnimationScene]:
    """
    从静态幻灯片内容生成动画脚本
    
    Args:
        scene_content: 幻灯片canvas内容
        style: 动画风格
        model: LLM模型
    
    Returns:
        动画场景列表
    """
    from app.services.llm import call_llm
    
    prompt = SLIDE_TO_ANIMATION_PROMPT.format(
        slide_content=json.dumps(scene_content, ensure_ascii=False),
        style=style,
    )
    
    response = await call_llm(
        prompt=prompt,
        system_prompt="你是动画设计师，只输出JSON。",
        model=model,
        temperature=0.7,
    )
    
    try:
        data = json.loads(response.strip())
        return [
            AnimationScene(
                id=s.get("id", str(uuid.uuid4())),
                duration=s.get("duration", 10),
                elements=s.get("elements", []),
                narration=s.get("narration", ""),
                transitions=s.get("transitions"),
            )
            for s in data.get("scenes", [])
        ]
    except:
        # 返回默认动画
        return _generate_default_animation(scene_content)


def _generate_default_animation(content: Dict) -> List[AnimationScene]:
    """生成默认动画脚本（当LLM不可用时）"""
    elements = content.get("canvas", {}).get("elements", [])
    
    scenes = []
    current_elements = []
    narration_parts = []
    elapsed_time = 0
    
    for el in elements:
        # 每个元素独立动画
        current_elements.append({
            "id": el.get("id"),
            "type": el.get("type"),
            "content": el.get("content"),
            "animation": {
                "type": "fadeIn",
                "duration": 0.8,
                "delay": elapsed_time,
            }
        })
        
        # 生成讲解文本
        if el.get("type") == "text":
            narration_parts.append(el.get("content", ""))
        
        elapsed_time += 2
    
    scenes.append(AnimationScene(
        id=str(uuid.uuid4()),
        duration=elapsed_time + 3,
        elements=current_elements,
        narration=" ".join(narration_parts[:3]) if narration_parts else "课程内容",
    ))
    
    return scenes


# ============ 2. 视频渲染服务 ============

# 方案 A: Remotion (React视频框架)
REMOTION_TEMPLATE = """
// Remotion 视频模板 - 前端渲染
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const MyVideo = ({ scenes }) => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff' }}>
      {scenes.map((scene, i) => (
        <SceneComponent 
          key={scene.id}
          scene={scene}
          frame={frame}
          startTime={i * 30 * scene.duration}
        />
      ))}
    </AbsoluteFill>
  );
};
"""


# 方案 B: Manim (Python数学动画)
MANIM_TEMPLATE = """
# Manim 数学动画模板 - 适合编程/数学课程
from manim import *

class CourseAnimation(Scene):
    def construct(self):
        # 标题动画
        title = Text("课程标题")
        self.play(Write(title), run_time=2)
        self.wait(1)
        
        # 内容动画
        content = Text("课程内容")
        self.play(FadeIn(content))
        
        # 图表动画
        chart = BarChart([...])
        self.play(Create(chart))
"""


# 方案 C: Puppeteer网页录制
PUPPETEER_SCRIPT = """
// Puppeteer 录制幻灯片为视频
const puppeteer = require('puppeteer');

async function recordSlideToVideo(slideHtml, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(slideHtml);
  
  // 开始录制
  const recorder = await page.evaluateHandle(() => {
    return new MediaRecorder(...);
  });
  
  // 执行动画序列
  for (const animation of animations) {
    await page.evaluate(animation.script);
    await page.waitForTimeout(animation.duration * 1000);
  }
  
  await browser.close();
}
"""


# ============ 3. TTS 配音集成 ============

TTS_PROVIDERS = {
    "azure": {
        "name": "Azure Speech",
        "voices": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
        "endpoint": "https://eastasia.tts.speech.microsoft.com",
        "quality": "high",
        "cost": "中等",
    },
    "elevenlabs": {
        "name": "ElevenLabs",
        "voices": ["Rachel", "Adam"],
        "endpoint": "https://api.elevenlabs.io/v1/text-to-speech",
        "quality": "极高",
        "cost": "较高",
    },
    "dashscope": {
        "name": "阿里云百炼",
        "voices": ["zhitian_emo", "zhiyan_emo"],
        "endpoint": "https://dashscope.aliyuncs.com/api/v1/services/audio/tts",
        "quality": "高",
        "cost": "低",
    },
    "edge-tts": {
        "name": "Edge TTS (免费)",
        "voices": ["zh-CN-Xiaoxiao", "zh-CN-Yunxi"],
        "endpoint": "本地执行",
        "quality": "中",
        "cost": "免费",
    },
}


async def generate_tts_audio(
    text: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    provider: str = "azure",
) -> bytes:
    """
    生成TTS音频
    
    Args:
        text: 讲解文本
        voice: 语音配置
        provider: TTS提供商
    
    Returns:
        音频数据
    """
    config = TTS_PROVIDERS.get(provider, TTS_PROVIDERS["edge-tts"])
    
    # 使用Edge TTS（免费方案）
    if provider == "edge-tts":
        import subprocess
        result = subprocess.run(
            ["edge-tts", "--voice", voice, "--text", text, "--write-media", "output.mp3"],
            capture_output=True,
        )
        with open("output.mp3", "rb") as f:
            return f.read()
    
    # 其他提供商需要API调用
    # TODO: 实现Azure/ElevenLabs集成
    raise NotImplementedError(f"TTS provider {provider} not implemented")


# ============ 4. 视频合成管道 ============

async def compose_video(
    animation_scenes: List[AnimationScene],
    config: AnimationConfig,
    output_path: str,
) -> str:
    """
    合成最终视频
    
    流程：
    1. 生成TTS音频（讲解配音）
    2. 渲染动画画面（Remotion/Puppeteer）
    3. 合成视频+音频（FFmpeg）
    4. 添加字幕（可选）
    
    Args:
        animation_scenes: 动画场景列表
        config: 动画配置
        output_path: 输出路径
    
    Returns:
        视频文件路径
    """
    # Step 1: 生成音频
    audio_files = []
    for scene in animation_scenes:
        audio = await generate_tts_audio(
            scene.narration,
            config.voice,
            provider="edge-tts",
        )
        audio_path = f"/tmp/audio_{scene.id}.mp3"
        with open(audio_path, "wb") as f:
            f.write(audio)
        audio_files.append(audio_path)
    
    # Step 2: 渲染画面（使用前端Remotion）
    # TODO: 需要前端配合
    
    # Step 3: FFmpeg合成
    import subprocess
    audio_concat = " ".join(audio_files)
    subprocess.run([
        "ffmpeg", "-i", "video.mp4",
        "-i", audio_concat,
        "-c:v", "copy", "-c:a", "aac",
        output_path
    ])
    
    return output_path


# ============ 5. API接口设计 ============

"""
@router.post("/generate-animation")
async def generate_course_animation(
    body: dict,
    user_id: str = Depends(get_current_user_id),
):
    """从课程内容生成动画视频"""
    course_id = body.get("course_id")
    style = body.get("style", "modern")
    
    # 1. 获取课程场景内容
    scenes = await get_course_scenes(course_id)
    
    # 2. 为每个场景生成动画脚本
    animation_scripts = []
    for scene in scenes:
        script = await generate_animation_script(scene.content, style)
        animation_scripts.append(script)
    
    # 3. 合成视频
    config = AnimationConfig(style=style)
    video_path = await compose_video(animation_scripts, config)
    
    # 4. 上传到OSS
    video_url = await upload_to_oss(video_path)
    
    return {"video_url": video_url, "duration": sum(s.duration for s in animation_scripts)}
"""


# ============ 推荐技术栈 ============

"""
轻量方案（适合个人/小团队）：
├── 前端：Remotion (React视频渲染)
├── 配音：Edge-TTS (免费)
├── 合成：FFmpeg
├── 存储：阿里云OSS
└── 成本：几乎免费

企业方案（适合商业化）：
├── 动画：Manim (数学可视化) + Remotion (通用)
├── 配音：Azure Speech / ElevenLabs
├── 数字人：HeyGen API (可选)
├── 存储：阿里云OSS + CDN
└── 成本：中等（按视频时长计费）

快速原型（本周可实现）：
├── 幻灯片录制：Puppeteer + HTML2Canvas
├── 配音：Edge-TTS
├── 合成：FFmpeg
└── 时间：1-2天开发
"""