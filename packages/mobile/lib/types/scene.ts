/**
 * Scene and Action 类型定义
 */

// Action 类型
export type ActionType = 'speech' | 'spotlight' | 'laser' | 'highlight' | 'gesture';

export interface SpeechActionData {
  text: string;
  audio_id?: string;
  audio_base64?: string;
  audio_format?: string;
}

export interface SpotlightActionData {
  target_element_id: string;
  dim_opacity?: number;  // 0-1, dimming intensity
  duration_ms?: number;
}

export interface LaserActionData {
  target_element_id?: string;  // 目标元素 ID
  start_position?: { x: number; y: number };
  end_position?: { x: number; y: number };
  color?: string;  // laser color, default '#ff3b30'
  duration_ms?: number;
}

export interface ActionDataMap {
  speech: SpeechActionData;
  spotlight: SpotlightActionData;
  laser: LaserActionData;
  highlight: SpotlightActionData;
  gesture: Record<string, never>;
}

export interface SceneAction<T extends ActionType = ActionType> {
  id: string;
  type: T;
  data: ActionDataMap[T];
}

// Scene 类型
export type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';

export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'video';
  content?: string;
  src?: string;
  position?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: string;
  };
  shapeType?: string;
}

export interface Canvas {
  width: number;
  height: number;
  background?: string;
  elements: CanvasElement[];
}

export interface SceneContent {
  type: SceneType;
  canvas?: Canvas;
  text?: string;
  description?: string;
  questions?: Array<{
    id: string;
    question: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  order_index?: number;
  content: SceneContent;
  actions: SceneAction[];
  whiteboards?: unknown;
}

// Agent 类型
export type AgentRole = 'teacher' | 'assistant' | 'student';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  color: string;
  persona?: string;
  avatar?: string;
  voiceConfig?: {
    providerId: string;
    voiceId: string;
  };
}

// Classroom 类型
export interface ClassroomStage {
  id: string;
  name: string;
  description?: string;
  language_directive?: string;
  style?: string;
  agent_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  stage: ClassroomStage;
  scenes: Scene[];
}