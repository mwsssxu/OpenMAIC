"""
交互式讲解动画 - 借鉴 VideoTutor 的 Animated Scene + Interactive Explanation
实现动态讲解效果，提升学习体验

VideoTutor 特点：
├── Animated Scene - 场景动画效果
├── Interactive Explanation - 交互式讲解
├── 画面跟随讲解进度变化
└── 用户可控制讲解节奏

OpenMAIC 现有：
├── ✅ scene_generator.py - Agent Actions (speech, spotlight)
├── ✅ personas.py - 智能体角色系统
├── ❌ 缺少：动态动画效果、用户交互控制

实现方案：
"""

from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
import json


# ============ 交互式动画类型 ============

INTERACTIVE_ANIMATION_TYPES = {
    # 入场动画
    "entrance": {
        "fadeIn": {"opacity": [0, 1], "duration": 0.5},
        "slideInLeft": {"x": [-100, 0], "duration": 0.6},
        "slideInRight": {"x": [100, 0], "duration": 0.6},
        "scaleUp": {"scale": [0, 1], "duration": 0.4},
        "bounceIn": {"scale": [0, 1.2, 1], "duration": 0.5},
        "typewriter": {"chars": "逐字显示", "duration": "动态"},
    },
    
    # 强调动画
    "emphasis": {
        "pulse": {"scale": [1, 1.1, 1], "duration": 0.3},
        "shake": {"x": [0, -5, 5, -5, 0], "duration": 0.4},
        "highlight": {"backgroundColor": ["transparent", "#ffff00"], "duration": 0.5},
        "glow": {"boxShadow": ["none", "0 0 20px rgba(255,255,0,0.5)"], "duration": 0.5},
    },
    
    # 退出动画
    "exit": {
        "fadeOut": {"opacity": [1, 0], "duration": 0.5},
        "slideOut": {"x": [0, 100], "duration": 0.5},
        "scaleDown": {"scale": [1, 0], "duration": 0.4},
    },
    
    # 特殊效果
    "special": {
        "drawPath": {"strokeDashoffset": [100, 0], "duration": 1},  # SVG路径绘制
        "countUp": {"number": [0, "目标值"], "duration": 1},  # 数字递增
        "typing": {"text": ["", "完整文本"], "duration": 2},  # 打字效果
        "morphShape": {"path": ["形状A", "形状B"], "duration": 1},  # 形态变换
    },
}


# ============ 动画时序控制器 ============

class AnimationTimeline(BaseModel):
    """动画时序"""
    element_id: str
    animation_type: str
    start_time: float  # 秒
    duration: float
    trigger: str = "auto"  # auto, click, scroll, narration
    params: Dict[str, Any] = {}


class NarrationSync(BaseModel):
    """讲解同步"""
    narration_segment: str  # 讲解文本片段
    duration: float  # 预计时长
    animations: List[AnimationTimeline]  # 同步的动画
    interaction_point: Optional[str] = None  # 交互点（如提问、测验）


# ============ 智能动画生成器 ============

ANIMATION_GENERATION_PROMPT = """
你是动画设计师。根据讲解内容生成动态讲解脚本。

## 场景内容
{scene_content}

## 讲解文本
{narration}

## 动画风格
{style}

## 要求
1. 分析讲解文本，拆分为多个片段
2. 为每个片段设计同步动画
3. 动画要配合讲解节奏（文字出现时高亮、图表数据时强调）
4. 添加交互点（让用户可控制进度）

输出格式：
{
  "timeline": [
    {
      "narration_segment": "现在我们来看第一个概念",
      "duration": 3,
      "animations": [
        {
          "element_id": "title",
          "animation_type": "fadeIn",
          "start_time": 0,
          "duration": 0.5,
          "trigger": "auto"
        }
      ],
      "interaction_point": null
    },
    {
      "narration_segment": "这个图表展示了...",
      "duration": 5,
      "animations": [
        {
          "element_id": "chart",
          "animation_type": "drawPath",
          "start_time": 1,
          "duration": 3,
          "trigger": "narration"
        }
      ],
      "interaction_point": "click_chart_to_explore"
    }
  ]
}
"""


async def generate_interactive_timeline(
    scene_content: Dict,
    narration: str,
    style: str = "modern",
    model: Optional[str] = None,
) -> List[NarrationSync]:
    """
    生成交互式讲解时序
    
    Args:
        scene_content: 场景内容（canvas.elements）
        narration: 讲解文本
        style: 动画风格
        model: LLM模型
    
    Returns:
        讲解同步时序列表
    """
    from app.services.llm import call_llm
    
    prompt = ANIMATION_GENERATION_PROMPT.format(
        scene_content=json.dumps(scene_content, ensure_ascii=False)[:1500],
        narration=narration,
        style=style,
    )
    
    response = await call_llm(
        prompt=prompt,
        system_prompt="你是动画时序设计师，只输出JSON。",
        model=model,
        temperature=0.7,
    )
    
    try:
        data = json.loads(response.strip())
        return [
            NarrationSync(
                narration_segment=s.get("narration_segment", ""),
                duration=s.get("duration", 3),
                animations=[
                    AnimationTimeline(**a) for a in s.get("animations", [])
                ],
                interaction_point=s.get("interaction_point"),
            )
            for s in data.get("timeline", [])
        ]
    except:
        return _generate_default_timeline(scene_content, narration)


def _generate_default_timeline(content: Dict, narration: str) -> List[NarrationSync]:
    """生成默认时序"""
    elements = content.get("canvas", {}).get("elements", [])
    
    timeline = []
    current_time = 0
    
    # 将讲解文本分段
    narration_parts = narration.split("\n") if narration else ["课程内容讲解"]
    
    for i, (el, text_part) in enumerate(zip(elements, narration_parts)):
        timeline.append(NarrationSync(
            narration_segment=text_part[:50] if len(text_part) > 50 else text_part,
            duration=3,
            animations=[
                AnimationTimeline(
                    element_id=el.get("id", f"el_{i}"),
                    animation_type="fadeIn",
                    start_time=current_time,
                    duration=0.5,
                    trigger="auto",
                )
            ],
            interaction_point=None,
        ))
        current_time += 3
    
    return timeline


# ============ 前端动画组件模板 ============

REACT_ANIMATION_COMPONENT = """
// InteractiveScene.tsx - React动画组件
import React, { useState, useEffect, useRef } from 'react';
import { useAnimation } from 'framer-motion';

interface InteractiveSceneProps {
  elements: Element[];
  timeline: NarrationSync[];
  onInteraction?: (point: string) => void;
}

export const InteractiveScene: React.FC<InteractiveSceneProps> = ({
  elements,
  timeline,
  onInteraction,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const controls = useAnimation();
  
  // 自动播放动画序列
  useEffect(() => {
    if (!isPlaying) return;
    
    const current = timeline[currentIndex];
    if (!current) return;
    
    // 执行动画
    current.animations.forEach(async (anim) => {
      const element = elements.find(e => e.id === anim.element_id);
      if (!element) return;
      
      // 使用 Framer Motion 执行动画
      await controls.start({
        ...ANIMATION_TYPES[anim.animation_type],
        transition: { duration: anim.duration },
      });
    });
    
    // 定时切换到下一个片段
    const timer = setTimeout(() => {
      if (currentIndex < timeline.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsPlaying(false);
      }
    }, current.duration * 1000);
    
    return () => clearTimeout(timer);
  }, [currentIndex, isPlaying]);
  
  // 处理用户交互
  const handleInteraction = (point: string) => {
    setIsPlaying(false);  // 暂停自动播放
    onInteraction?.(point);
  };
  
  return (
    <div className="scene-container">
      {/* 讲解文本 */}
      <div className="narration">
        <NarrationPlayer 
          text={timeline[currentIndex]?.narration_segment}
          isPlaying={isPlaying}
        />
      </div>
      
      {/* 画布元素 */}
      <div className="canvas">
        {elements.map((el, i) => (
          <motion.div
            key={el.id}
            animate={controls}
            style={el.position}
            onClick={() => handleInteraction(el.interactionPoint)}
          >
            {renderElement(el)}
          </motion.div>
        ))}
      </div>
      
      {/* 控制按钮 */}
      <div className="controls">
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button onClick={() => setCurrentIndex(currentIndex - 1)}>上一个</button>
        <button onClick={() => setCurrentIndex(currentIndex + 1)}>下一个</button>
      </div>
    </div>
  );
};
"""


# ============ SVG路径动画（数学/图表） ============

SVG_PATH_ANIMATION = """
// SVG路径绘制动画
<svg viewBox="0 0 1000 500">
  <path
    d="M 100 200 L 200 150 L 300 250 L 400 100"
    stroke="blue"
    stroke-width="2"
    fill="none"
    style={{
      strokeDasharray: 500,  // 总路径长度
      strokeDashoffset: animationProgress,  // 从500到0
    }}
  />
</svg>

// 动画控制
useEffect(() => {
  const animate = async () => {
    await controls.start({
      strokeDashoffset: [500, 0],
      transition: { duration: 2, ease: 'linear' },
    });
  };
  animate();
}, []);
"""


# ============ 打字机效果 ============

TYPEWRITER_COMPONENT = """
// TypewriterText.tsx - 打字机效果组件
import React, { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;  // 每字毫秒
  onComplete?: () => void;
}

export const TypewriterText: React.FC<TypewriterProps> = ({
  text,
  speed = 50,
  onComplete,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex >= text.length) {
      onComplete?.();
      return;
    }
    
    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
      setCurrentIndex(currentIndex + 1);
    }, speed);
    
    return () => clearTimeout(timer);
  }, [currentIndex, text]);
  
  return (
    <span>
      {displayedText}
      <span className="cursor">|</span>
    </span>
  );
};
"""


# ============ TTS同步控制 ============

class TTSController:
    """TTS播放控制器"""
    
    def __init__(self):
        self.current_position = 0
        self.is_playing = False
        self.word_timing = []  # [(word, start_time, end_time)]
    
    async def sync_with_animation(self, timeline: List[NarrationSync]):
        """
        将TTS与动画同步
        
        使用方案：
        1. Azure Speech - 支持word boundary事件
        2. ElevenLabs - 支持timing metadata
        3. 本地方案 - 估算每字时长（~200ms）
        """
        for segment in timeline:
            words = segment.narration_segment.split()
            
            # 估算每字时长
            word_duration = 0.2  # 秒
            
            self.word_timing.extend([
                (word, i * word_duration, (i + 1) * word_duration)
                for i, word in enumerate(words)
            ])
        
        return self.word_timing
    
    def get_current_word(self, elapsed_time: float) -> str:
        """获取当前播放的词"""
        for word, start, end in self.word_timing:
            if start <= elapsed_time < end:
                return word
        return ""


# ============ 用户交互控制 ============

INTERACTION_TYPES = {
    "click_to_continue": {
        "description": "点击继续下一步",
        "implementation": "按钮点击触发下一动画",
    },
    
    "hover_to_highlight": {
        "description": "悬停高亮元素",
        "implementation": "鼠标悬停显示详情",
    },
    
    "click_to_expand": {
        "description": "点击展开详情",
        "implementation": "弹出模态框或折叠面板",
    },
    
    "drag_to_adjust": {
        "description": "拖拽调整参数",
        "implementation": "滑块或拖拽交互",
    },
    
    "quiz_popup": {
        "description": "弹出测验",
        "implementation": "讲解中途插入测验",
    },
    
    "ask_question": {
        "description": "随时提问",
        "implementation": "侧边栏聊天窗口",
    },
}


# ============ 实现难度评估 ============

"""
实现难度：⭐⭐⭐⭐ (较高，需前端配合)

容易实现的部分：
├── ✅ 基础动画类型定义 (已有Framer Motion)
├── ✅ 时序数据结构设计
├── ✅ 打字机效果组件 (纯前端)
├── ✅ 基础入场/强调动画
└── ✅ 暂停/播放控制

中等难度：
├── ⚠️ LLM生成动画时序 (需精准控制)
├── ⚠️ TTS与动画同步 (需word timing)
├── ⚠️ SVG路径绘制动画
└── ⚠️ 数字递增效果

较难部分：
├── ❌ 实时讲解跟随画面变化
├── ❌ 用户手势控制动画节奏
├── ❌ AI智能体与动画联动
└── ❌ 3D动画效果

推荐实现顺序：
1. Week 1: 基础动画 + 暂停播放控制
2. Week 2: 打字机效果 + SVG路径动画
3. Week 3: TTS同步 + 交互点设计
4. Week 4: LLM动画生成 + 智能体联动
"""


# ============ 快速实现方案 ============

"""
最快实现路径（本周可完成）：

Step 1: 前端动画基础 (1天)
├── 引入 Framer Motion
├── 实现 fadeIn/slideIn 基础动画
├── 添加播放/暂停控制
└── 文件：packages/mobile/components/AnimatedScene.tsx

Step 2: 打字机讲解效果 (1天)
├── TypewriterText 组件
├── 配合智能体语音
└── 文件：packages/mobile/components/TypewriterText.tsx

Step 3: 简单交互控制 (1天)
├── "点击继续" 按钮
├── 悬停高亮效果
└── 文件：packages/mobile/components/InteractiveControls.tsx

Step 4: 后端时序API (1天)
├── 生成动画时序数据
├── 返回给前端执行
└── 文件：app/routes/animation.py

总计：4天完成基础版本
"""