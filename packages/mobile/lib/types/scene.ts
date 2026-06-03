/**
 * Scene and Action 类型定义 - Mobile端
 */

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

// Action 类型 - 与Web端对齐
export type ActionType =
  | 'speech'
  | 'spotlight'
  | 'laser'
  | 'wb_draw_text'
  | 'wb_draw_shape'
  | 'wb_draw_chart'
  | 'wb_draw_latex'
  | 'wb_draw_table'
  | 'wb_draw_line'
  | 'wb_draw_code'
  | 'wb_edit_code'
  | 'wb_open'
  | 'wb_clear'
  | 'wb_close'
  | 'wb_delete'
  | 'discussion'
  | 'play_video'
  | 'widget_highlight'
  | 'widget_setState'
  | 'widget_annotation'
  | 'widget_reveal'
;
export interface SpeechActionData {
  text: string;
  audio_id?: string;
  audio_base64?: string;
  audio_format?: string;
}

export interface SpotlightActionData {
  target_element_id: string;
  dim_opacity?: number;
  duration_ms?: number;
}

export interface LaserActionData {
  target_element_id?: string;
  start_position?: { x: number; y: number };
  end_position?: { x: number; y: number };
  color?: string;
  duration_ms?: number;
}

export interface WbDrawTextActionData {
  text?: string;
  content?: string;
  fontSize?: number;
  color?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export interface WbDrawShapeActionData {
  path?: string;
  shape?: 'rectangle' | 'circle' | 'triangle' | 'line';
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  fill?: string;
  viewBox?: [number, number];
}

export interface WbDrawChartActionData {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'radar';
  x: number;
  y: number;
  width: number;
  height: number;
  data: {
    labels: string[];
    legends: string[];
    series: number[][];
  };
  themeColors?: string[];
}

export interface WbDrawLatexActionData {
  latex: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface WbDrawTableActionData {
  x: number;
  y: number;
  width: number;
  height: number;
  data: string[][];
  outline?: { width: number; style: string; color: string };
  theme?: { color: string; rowHeader?: boolean };
}

export interface WbDrawLineActionData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed';
  points?: ['', 'arrow'] | ['arrow', ''] | ['arrow', 'arrow'] | ['', ''];
}

export interface WbDrawCodeActionData {
  language: string;
  code: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fileName?: string;
}

export interface WbEditCodeActionData {
  elementId: string;
  operation: 'insert_after' | 'insert_before' | 'delete_lines' | 'replace_lines';
  lineId?: string;
  lineIds?: string[];
  content?: string;
}

export interface WbDeleteActionData {
  elementId: string;
}

export interface DiscussionActionData {
  topic: string;
  prompt?: string;
  agentId?: string;
}

export interface PlayVideoActionData {
  elementId: string;
}

export interface WidgetHighlightActionData {
  target: string; // CSS selector or element ID in the WebView
  content?: string; // Speech text to accompany the highlight
}

export interface WidgetSetStateActionData {
  state: Record<string, unknown>; // Simulation variables to set
  content?: string; // Speech text to accompany the state change
}

export interface WidgetAnnotationActionData {
  target: string; // CSS selector for the annotated element
  content?: string; // Annotation tooltip text
}

export interface WidgetRevealActionData {
  target: string; // CSS selector for the hidden element to reveal
  content?: string; // Speech text to accompany the reveal
}

export interface ActionDataMap {
  speech: SpeechActionData;
  spotlight: SpotlightActionData;
  laser: LaserActionData;
  wb_draw_text: WbDrawTextActionData;
  wb_draw_shape: WbDrawShapeActionData;
  wb_draw_chart: WbDrawChartActionData;
  wb_draw_latex: WbDrawLatexActionData;
  wb_draw_table: WbDrawTableActionData;
  wb_draw_line: WbDrawLineActionData;
  wb_draw_code: WbDrawCodeActionData;
  wb_edit_code: WbEditCodeActionData;
  wb_open: Record<string, never>;
  wb_clear: Record<string, never>;
  wb_close: Record<string, never>;
  wb_delete: WbDeleteActionData;
  discussion: DiscussionActionData;
  play_video: PlayVideoActionData;
  widget_highlight: WidgetHighlightActionData;
  widget_setState: WidgetSetStateActionData;
  widget_annotation: WidgetAnnotationActionData;
  widget_reveal: WidgetRevealActionData;
}

export interface SceneAction<T extends ActionType = ActionType> {
  id: string;
  type: T;
  data: ActionDataMap[T];
}

// Scene 类型
export type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';

// Slide content - 使用Web端定义的结构
export interface SlideCanvas {
  elements: any[]; // PPTElement数组，直接使用后端返回的数据
  background?: {
    type: 'solid' | 'image' | 'gradient';
    color?: string;
  };
  theme?: {
    backgroundColor: string;
    fontColor: string;
    fontName: string;
  };
}

export interface SlideContent {
  type: 'slide';
  canvas: SlideCanvas;
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: Array<{ label: string; value: string }>;
  answer?: string[];
  points?: number;
  hasAnswer?: boolean;
  commentPrompt?: string; // AI批改提示
  analysis?: string; // 解析
}

export interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
}

export interface InteractiveContent {
  type: 'interactive';
  url: string;
  html?: string;
}

export interface PblContent {
  type: 'pbl';
  url?: string;
  html?: string;
  projectData?: Record<string, unknown>;
}

export type SceneContent = SlideContent | QuizContent | InteractiveContent | PblContent;

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  order_index?: number;
  content: SceneContent;
  actions?: SceneAction[];
  whiteboards?: unknown;
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
  agents?: Agent[];
}