/**
 * Playback Engine - 课堂场景播放引擎
 *
 * 执行场景 Actions（speech, spotlight, laser 等）
 * speech 动作播放 TTS 音频，无音频时使用 expo-speech 作为 fallback
 * 支持按需请求 TTS API 生成音频（与 Web 端对齐）
 *
 * 改进：
 * - 只播放当前场景，不自动切换到下一个
 * - 支持暂停功能
 * - 互动/测验场景不播放音频
 */

import { AudioPlayer } from './audio-player';
import { saveAudioFile, getAudioPath } from '../storage/audio-storage';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Scene, SceneAction, SpeechActionData, SpotlightActionData, LaserActionData } from '../types';
import { apiClient } from '../api-client';
import { stripHtmlAndSSML } from '../utils/html-stripper';

export type EngineMode = 'idle' | 'playing' | 'paused';

// TTS 配置（可由外部设置）
export interface TTSConfig {
  provider: 'qwen' | 'openai' | 'minimax' | 'browser' | 'voxcpm';
  voice: string;
  speed: number;
  model?: string;
  // VoxCPM 特有配置
  backend?: 'vllm-omni' | 'python-api' | 'nano-vllm';
  voicePrompt?: string;
}

// 默认 TTS 配置
const DEFAULT_TTS_CONFIG: TTSConfig = {
  provider: 'qwen',
  voice: 'Cherry',
  speed: 1.0,
  model: 'qwen3-tts-flash',
};

// 不需要播放音频的场景类型
const NON_SPEECH_SCENE_TYPES = ['quiz', 'interactive', 'pbl'];

export type PlaybackEngineCallbacks = {
  onSceneChange?: (index: number, scene: Scene | null) => void;
  onActionExecute?: (action: SceneAction) => void;
  onComplete?: () => void;
  onModeChange?: (mode: EngineMode) => void;
  onError?: (error: Error) => void;
  onTTSGenerate?: (audioId: string) => void;
  onTTSReady?: (audioId: string) => void;
  // Spotlight/Laser visual effects
  onSpotlight?: (elementId: string, dimness?: number) => void;
  onLaser?: (elementId: string, color?: string) => void;
  onClearEffects?: () => void;
  // Whiteboard actions - 自动触发白板显示
  onWhiteboardAction?: (action: SceneAction) => void;
  onWhiteboardOpen?: () => void;
};

/**
 * 播放引擎
 */
export class PlaybackEngine {
  private scenes: Scene[] = [];
  private sceneIndex: number = 0;
  private actionIndex: number = 0;
  private mode: EngineMode = 'idle';
  private audioPlayer: AudioPlayer;
  private callbacks: PlaybackEngineCallbacks = {};
  private processing: boolean = false;
  private ttsConfig: TTSConfig = DEFAULT_TTS_CONFIG;
  private audioCache: Map<string, { base64: string; format: string }> = new Map();
  // expo-speech 状态跟踪
  private speechPlaying: boolean = false;

  constructor(scenes: Scene[], callbacks?: PlaybackEngineCallbacks, ttsConfig?: TTSConfig) {
    this.scenes = scenes;
    if (callbacks) {
      this.callbacks = callbacks;
    }
    if (ttsConfig) {
      this.ttsConfig = ttsConfig;
    }

    this.audioPlayer = new AudioPlayer({
      onPlayStart: () => {
        // 音频开始播放
      },
      onPlayEnd: () => {
        // 音频播放完成，只有在 playing 状态才继续处理
        if (this.mode === 'playing') {
          this.processing = false;
        }
      },
      onError: (error) => {
        this.callbacks.onError?.(error);
        this.processing = false;
      },
    });
  }

  /**
   * 设置 TTS 配置
   */
  setTTSConfig(config: Partial<TTSConfig>) {
    this.ttsConfig = { ...this.ttsConfig, ...config };

    // 如果正在播放且只更新了语速，直接调整播放速率
    if (config.speed !== undefined && this.audioPlayer.isPlaying()) {
      this.audioPlayer.setRate(config.speed);
    } else {
      // 其他配置变更，清除缓存重新生成
      this.audioCache.clear();
    }
  }

  /**
   * 获取当前 TTS 配置
   */
  getTTSConfig(): TTSConfig {
    return this.ttsConfig;
  }

  /**
   * 清除音频缓存
   */
  clearAudioCache() {
    this.audioCache.clear();
  }

  /**
   * 获取当前模式
   */
  getMode(): EngineMode {
    return this.mode;
  }

  /**
   * 获取当前场景索引
   */
  getSceneIndex(): number {
    return this.sceneIndex;
  }

  /**
   * 获取当前场景
   */
  getCurrentScene(): Scene | null {
    return this.scenes[this.sceneIndex] || null;
  }

  /**
   * 播放当前场景（不自动切换到下一个）
   * Guard: prevent re-entry if already playing or processing
   */
  async playCurrentScene(): Promise<void> {
    // Guard: prevent re-entry
    if (this.mode === 'playing' || this.processing) {
      console.log('[PlaybackEngine] Already playing, skip playCurrentScene');
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene) {
      console.log('[PlaybackEngine] No current scene');
      return;
    }

    // Check scene type
    if (NON_SPEECH_SCENE_TYPES.includes(scene.type)) {
      console.log(`[PlaybackEngine] Skipping speech for ${scene.type} scene`);
      return;
    }

    this.mode = 'playing';
    this.processing = true;
    this.callbacks.onModeChange?.(this.mode);
    this.actionIndex = 0;

    await this.processSceneActions(scene);

    // After processing, set mode to idle (single scene playback)
    this.processing = false;
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);
  }

  /**
   * 处理场景的所有 actions
   * 按顺序执行：spotlight/laser非阻塞立即执行，speech阻塞等待播放完成
   * 白板actions触发白板显示（与Web端对齐）
   */
  private async processSceneActions(scene: Scene): Promise<void> {
    const actions = scene.actions || [];

    if (actions.length === 0) {
      // 没有 actions，从内容中提取文本朗读
      await this.speakSceneContent(scene);
      return;
    }

    // 先清除之前的视觉效果
    this.callbacks.onClearEffects?.();

    // 按顺序处理所有 actions，检查播放状态防止循环
    for (const action of actions) {
      if (this.mode !== 'playing') {
        console.log('[PlaybackEngine] Playback stopped, exiting processSceneActions');
        return;
      }
      this.callbacks.onActionExecute?.(action);

      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
        // 非阻塞，立即继续下一个action
      } else if (action.type === 'laser') {
        this.executeLaser(action);
        // 非阻塞，立即继续下一个action
      } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
        // 白板绘制action - 触发白板显示（与Web端对齐）
        this.executeWhiteboard(action);
        // 非阻塞，立即继续下一个action
      } else if (action.type === 'wb_open') {
        // 打开白板
        this.callbacks.onWhiteboardOpen?.();
      } else if (action.type === 'wb_clear' || action.type === 'wb_close') {
        // 清除/关闭白板 - 触发清除
        this.callbacks.onClearEffects?.();
      } else if (action.type === 'speech') {
        // 阻塞，等待播放完成再继续
        await this.executeSpeech(action as SceneAction<'speech'>);
      }
      // 其他action类型暂不处理
    }
  }

  /**
   * 执行白板绘制action（非阻塞）
   * 触发白板显示和内容绘制
   */
  private executeWhiteboard(action: SceneAction): void {
    // 触发白板action回调
    this.callbacks.onWhiteboardAction?.(action);
    // 自动打开白板
    this.callbacks.onWhiteboardOpen?.();
  }

  /**
   * 开始自动播放所有场景（按用户需求使用）
   */
  async startAutoPlay(): Promise<void> {
    if (this.scenes.length === 0) {
      this.callbacks.onComplete?.();
      return;
    }

    this.sceneIndex = 0;
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);
    this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());

    await this.playCurrentSceneAuto();
  }

  /**
   * 自动播放当前场景并切换到下一个
   */
  private async playCurrentSceneAuto(): Promise<void> {
    if (this.mode !== 'playing') return;

    const scene = this.getCurrentScene();
    if (!scene) return;

    // 跳过不需要播放的场景
    if (NON_SPEECH_SCENE_TYPES.includes(scene.type)) {
      await this.nextScene();
      // 继续播放下一个场景（与 Web端一致）
      if (this.mode === 'playing') {
        await this.playCurrentSceneAuto();
      }
      return;
    }

    const actions = scene.actions || [];

    if (actions.length === 0) {
      await this.speakSceneContentAuto(scene);
      return;
    }

    // 先清除之前的视觉效果
    this.callbacks.onClearEffects?.();

    // 处理所有 actions（spotlight/laser/whiteboard 非阻塞）
    for (const action of actions) {
      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
      } else if (action.type === 'laser') {
        this.executeLaser(action);
      } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
        this.executeWhiteboard(action);
      } else if (action.type === 'wb_open') {
        this.callbacks.onWhiteboardOpen?.();
      } else if (action.type === 'wb_clear' || action.type === 'wb_close') {
        this.callbacks.onClearEffects?.();
      } else if (action.type === 'speech') {
        await this.executeSpeechAuto(action as SceneAction<'speech'>);
        return;
      }
    }

    // 没有 speech action，切换下一个
    await this.nextScene();
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    this.mode = 'paused';
    this.callbacks.onModeChange?.(this.mode);
    this.processing = false;

    // 暂停音频播放器
    await this.audioPlayer.pause();

    // 停止 expo-speech
    if (this.speechPlaying) {
      Speech.stop();
      this.speechPlaying = false;
    }
  }

  /**
   * 继续播放
   */
  async resume(): Promise<void> {
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    // 继续音频播放
    await this.audioPlayer.resume();

    // 如果没有音频正在播放，重新开始当前场景
    if (!this.audioPlayer.isPlaying() && !this.speechPlaying) {
      await this.playCurrentScene();
    }
  }

  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);
    this.processing = false;

    await this.audioPlayer.stop();
    Speech.stop();
    this.speechPlaying = false;

    // 清除视觉效果（与 Web端 一致）
    this.callbacks.onClearEffects?.();
  }

  /**
   * 切换到下一个场景（不自动播放）
   */
  async nextScene(): Promise<void> {
    await this.stop();

    if (this.sceneIndex < this.scenes.length - 1) {
      this.sceneIndex++;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    } else {
      this.callbacks.onComplete?.();
    }
  }

  /**
   * 切换到上一个场景（不自动播放）
   */
  async prevScene(): Promise<void> {
    await this.stop();

    if (this.sceneIndex > 0) {
      this.sceneIndex--;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    }
  }

  /**
   * 跳转到指定场景（不自动播放）
   */
  async jumpToScene(index: number): Promise<void> {
    await this.stop();

    if (index >= 0 && index < this.scenes.length) {
      this.sceneIndex = index;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    }
  }

  /**
   * 从场景内容中提取文本并朗读（单场景模式）
   * 与 Web端对齐：提取笔记内容（笔记内容），去除 HTML 标签
   */
  private async speakSceneContent(scene: Scene): Promise<void> {
    let textToSpeak = '';

    // 检查是否为 slide 类型内容（与 Web端一致）
    const slideContent = scene.content as any;
    if (slideContent?.canvas?.elements) {
      const textElements = slideContent.canvas.elements
        .filter((el: any) => el.type === 'text' && el.content)
        .map((el: any) => {
          const content = el.content as string;
          // 去除 HTML 标签，提取纯文本（与 Web端一致）
          if (content.includes('<p') || content.includes('<')) {
            return content.replace(/<[^>]+>/g, '');
          }
          return content;
        });
      textToSpeak = textElements.join('\n');
    }

    if (textToSpeak && textToSpeak.length > 10) {
      // 使用 TTS API 或 expo-speech
      await this.speakText(textToSpeak, `scene_${scene.id}`);
    }
  }

  /**
   * 自动播放模式的朗读
   */
  private async speakSceneContentAuto(scene: Scene): Promise<void> {
    await this.speakSceneContent(scene);

    // 朗读完成后切换下一个场景
    setTimeout(async () => {
      if (this.mode === 'playing') {
        await this.nextScene();
        if (this.mode === 'playing') {
          await this.playCurrentSceneAuto();
        }
      }
    }, 500);
  }

  /**
   * 执行 speech action（单场景模式）
   */
  private async executeSpeech(action: SceneAction<'speech'>): Promise<void> {
    const data = action.data as SpeechActionData;
    const text = data.text;

    if (!text) {
      console.warn('[PlaybackEngine] Speech action has no text');
      return;
    }

    await this.speakText(text, `tts_${action.id}`);
  }

  /**
   * 执行 speech action（自动播放模式）
   */
  private async executeSpeechAuto(action: SceneAction<'speech'>): Promise<void> {
    await this.executeSpeech(action);

    // 朗读完成后切换下一个场景
    setTimeout(async () => {
      if (this.mode === 'playing') {
        await this.nextScene();
        if (this.mode === 'playing') {
          await this.playCurrentSceneAuto();
        }
      }
    }, 500);
  }

  /**
   * 执行 spotlight action（非阻塞）
   * 触发视觉聚焦效果
   */
  private executeSpotlight(action: SceneAction): void {
    const data = action.data as SpotlightActionData;
    const elementId = data.target_element_id;
    const dimness = data.dim_opacity ?? 0.7; // 默认变暗程度

    if (!elementId) {
      console.warn('[PlaybackEngine] Spotlight action has no target_element_id');
      return;
    }

    this.callbacks.onSpotlight?.(elementId, dimness);
  }

  /**
   * 执行 laser action（非阻塞）
   * 触发激光笔动画
   */
  private executeLaser(action: SceneAction): void {
    const data = action.data as LaserActionData;
    // 使用 target_element_id（如果存在）或从 end_position 推断
    const elementId = data.target_element_id || action.id;
    const color = data.color || '#ff3b30';

    if (!elementId) {
      console.warn('[PlaybackEngine] Laser action has no target');
      return;
    }

    this.callbacks.onLaser?.(elementId, color);
  }

  /**
   * 播放文本（TTS API 或 expo-speech fallback）
   * Strip HTML/SSML tags and use scene-specific cache keys
   */
  private async speakText(text: string, audioId: string): Promise<void> {
    // Strip HTML/SSML tags from text
    const cleanText = stripHtmlAndSSML(text);

    if (!cleanText || cleanText.length < 2) {
      console.warn('[PlaybackEngine] Text too short after stripping HTML, skip TTS');
      return;
    }

    // Generate cache key with scene index to ensure scene-specific caching
    const sceneIndex = this.sceneIndex;
    const cacheKey = `tts_s${sceneIndex}_${audioId}_${this.ttsConfig.provider}_${this.ttsConfig.voice}_${this.ttsConfig.speed}`;

    // 1. Check memory cache
    const memoryCached = this.audioCache.get(cacheKey);
    if (memoryCached) {
      console.log(`[PlaybackEngine] Using memory cached audio: ${cacheKey}`);
      if (Platform.OS === 'web') {
        this.audioPlayer.cacheAudio(cacheKey, memoryCached.base64, memoryCached.format);
      } else {
        saveAudioFile(cacheKey, memoryCached.base64, memoryCached.format);
      }
      await this.audioPlayer.play(cacheKey, memoryCached.format);
      return;
    }

    // 2. Check file system cache (native only)
    if (Platform.OS !== 'web') {
      const filePath = getAudioPath(cacheKey);
      if (filePath) {
        console.log(`[PlaybackEngine] Using file cached audio: ${cacheKey}`);
        try {
          const base64 = await fetch(`file://${filePath}`).then(r => r.text());
          this.audioCache.set(cacheKey, { base64, format: 'mp3' });
          await this.audioPlayer.play(cacheKey, 'mp3');
          return;
        } catch (err) {
          console.warn('[PlaybackEngine] Failed to load cached file:', err);
        }
      }
    }

    // 3. Request TTS API
    if (this.ttsConfig.provider !== 'browser') {
      try {
        this.callbacks.onTTSGenerate?.(cacheKey);

        const result = await apiClient.generateTTS(
          cleanText, // Use cleaned text
          cacheKey, // Use scene-specific cache key
          this.ttsConfig.provider,
          this.ttsConfig.voice,
          this.ttsConfig.speed,
          this.ttsConfig.model,
          // VoxCPM specific config
          this.ttsConfig.provider === 'voxcpm' ? {
            backend: this.ttsConfig.backend,
            voicePrompt: this.ttsConfig.voicePrompt,
          } : undefined,
        );

        if (result.success && result.base64) {
          // Cache to memory
          this.audioCache.set(cacheKey, { base64: result.base64, format: result.format });

          // Web environment: cache base64 to AudioPlayer
          if (Platform.OS === 'web') {
            this.audioPlayer.cacheAudio(result.audioId, result.base64, result.format);
          } else {
            // Native environment: save to file system for persistence
            saveAudioFile(cacheKey, result.base64, result.format);
          }

          this.callbacks.onTTSReady?.(result.audioId);
          await this.audioPlayer.play(result.audioId, result.format);
          return;
        }
      } catch (err) {
        console.warn('[PlaybackEngine] TTS API failed:', err);
      }
    }

    // 4. expo-speech fallback
    this.speechPlaying = true;
    try {
      await Speech.speak(cleanText, { // Use cleaned text
        language: 'zh-CN',
        rate: this.ttsConfig.speed * 0.9,
        onDone: () => {
          this.speechPlaying = false;
        },
        onError: () => {
          this.speechPlaying = false;
        },
      });
    } catch {
      this.speechPlaying = false;
    }
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.audioPlayer.dispose();
    Speech.stop();
    this.mode = 'idle';
    this.processing = false;
    this.speechPlaying = false;
  }
}