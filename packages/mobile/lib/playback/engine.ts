/**
 * Playback Engine - 课堂场景播放引擎
 *
 * 执行场景 Actions（speech, spotlight, laser 等）
 * speech 动作播放 TTS 音频，无音频时使用 expo-speech 作为 fallback
 * 支持按需请求 TTS API 生成音频（与 Web 端对齐）
 *
 * 与 Web 端对齐的关键逻辑：
 * - 播放完当前场景后设为 idle（单场景模式）
 * - resume 时如果音频已结束，重新播放当前场景
 * - spotlight/laser 效果 5 秒自动清除
 * - 效果清除时同时取消定时器（防止跨场景残留）
 */

import { AudioPlayer } from './audio-player';
import { saveAudioFile, getAudioPath } from '../storage/audio-storage';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Scene, SceneAction, SpeechActionData, SpotlightActionData, LaserActionData } from '../types';
import { apiClient } from '../api-client';
import { stripHtmlAndSSML } from '../utils/html-stripper';

// Static import for File class (consistent with audio-storage.ts)
let FileClass: any = null;
if (Platform.OS !== 'web') {
  try {
    FileClass = require('expo-file-system').File;
  } catch {}
}

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

// Fire-and-forget effects auto-clear after 5 seconds (aligned with web)
const EFFECT_AUTO_CLEAR_MS = 5000;

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
  // Whiteboard actions
  onWhiteboardAction?: (action: SceneAction) => void;
  onWhiteboardOpen?: () => void;
};

export class PlaybackEngine {
  private scenes: Scene[] = [];
  private sceneIndex: number = 0;
  private mode: EngineMode = 'idle';
  private audioPlayer: AudioPlayer;
  private callbacks: PlaybackEngineCallbacks = {};
  private ttsConfig: TTSConfig = DEFAULT_TTS_CONFIG;
  private audioCache: Map<string, { base64: string; format: string }> = new Map();
  private speechPlaying: boolean = false;
  // Fire-and-forget effect auto-clear timer
  private effectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(scenes: Scene[], callbacks?: PlaybackEngineCallbacks, ttsConfig?: TTSConfig) {
    this.scenes = scenes;
    if (callbacks) {
      this.callbacks = callbacks;
    }
    if (ttsConfig) {
      this.ttsConfig = ttsConfig;
    }

    this.audioPlayer = new AudioPlayer({
      onPlayStart: () => {},
      onPlayEnd: () => {
        // Audio finished — engine will handle advancement
      },
      onError: (error) => {
        this.callbacks.onError?.(error);
      },
    });
  }

  setTTSConfig(config: Partial<TTSConfig>) {
    this.ttsConfig = { ...this.ttsConfig, ...config };

    if (config.speed !== undefined && this.audioPlayer.isPlaying()) {
      this.audioPlayer.setRate(config.speed);
    } else {
      this.audioCache.clear();
    }
  }

  getTTSConfig(): TTSConfig {
    return this.ttsConfig;
  }

  clearAudioCache() {
    this.audioCache.clear();
  }

  getMode(): EngineMode {
    return this.mode;
  }

  getSceneIndex(): number {
    return this.sceneIndex;
  }

  getCurrentScene(): Scene | null {
    return this.scenes[this.sceneIndex] || null;
  }

  /**
   * 播放当前场景（单场景模式）
   * 播放完成后设为 idle，允许用户重新播放（与 Web 端一致）
   */
  async playCurrentScene(): Promise<void> {
    if (this.mode === 'playing') {
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene) return;

    if (NON_SPEECH_SCENE_TYPES.includes(scene.type)) {
      return;
    }

    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    await this.processSceneActions(scene);

    // Aligned with web: single scene playback returns to idle after completion
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);
  }

  /**
   * 处理场景的所有 actions
   * spotlight/laser 非阻塞，speech 阻塞等待完成
   */
  private async processSceneActions(scene: Scene): Promise<void> {
    const actions = scene.actions || [];

    if (actions.length === 0) {
      await this.speakSceneContent(scene);
      return;
    }

    this.clearEffects();

    for (const action of actions) {
      if (this.mode !== 'playing') return;

      this.callbacks.onActionExecute?.(action);

      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
      } else if (action.type === 'laser') {
        this.executeLaser(action);
      } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
        this.executeWhiteboard(action);
      } else if (action.type === 'wb_open') {
        this.callbacks.onWhiteboardOpen?.();
      } else if (action.type === 'wb_clear' || action.type === 'wb_close') {
        this.clearEffects();
      } else if (action.type === 'speech') {
        await this.executeSpeech(action as SceneAction<'speech'>);
      }
    }
  }

  private executeWhiteboard(action: SceneAction): void {
    this.callbacks.onWhiteboardAction?.(action);
    this.callbacks.onWhiteboardOpen?.();
  }

  /**
   * 自动播放所有场景
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

  private async playCurrentSceneAuto(): Promise<void> {
    if (this.mode !== 'playing') return;

    const scene = this.getCurrentScene();
    if (!scene) return;

    if (NON_SPEECH_SCENE_TYPES.includes(scene.type)) {
      await this.nextScene();
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

    this.clearEffects();

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
        this.clearEffects();
      } else if (action.type === 'speech') {
        await this.executeSpeechAuto(action as SceneAction<'speech'>);
        return;
      }
    }

    await this.nextScene();
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    this.mode = 'paused';
    this.callbacks.onModeChange?.(this.mode);

    await this.audioPlayer.pause();

    if (this.speechPlaying) {
      Speech.stop();
      this.speechPlaying = false;
    }
  }

  /**
   * 继续播放（与 Web 端对齐）
   * Web: resume audio if paused, else processNext() if audio finished during pause
   */
  async resume(): Promise<void> {
    if (this.mode !== 'paused') return;

    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    if (this.speechPlaying) {
      // expo-speech doesn't support resume, re-speak is handled by caller
      return;
    }

    if (this.audioPlayer.isPlaying()) {
      // Audio was paused — resume it
      await this.audioPlayer.resume();
    } else {
      // Aligned with web: TTS finished while paused, replay current scene
      await this.playCurrentScene();
    }
  }

  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);

    await this.audioPlayer.stop();
    if (this.speechPlaying) {
      Speech.stop();
      this.speechPlaying = false;
    }

    this.clearEffects();
  }

  async nextScene(): Promise<void> {
    await this.stop();

    if (this.sceneIndex < this.scenes.length - 1) {
      this.sceneIndex++;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    } else {
      this.callbacks.onComplete?.();
    }
  }

  async prevScene(): Promise<void> {
    await this.stop();

    if (this.sceneIndex > 0) {
      this.sceneIndex--;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    }
  }

  async jumpToScene(index: number): Promise<void> {
    await this.stop();

    if (index >= 0 && index < this.scenes.length) {
      this.sceneIndex = index;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());
    }
  }

  /**
   * 从场景内容提取文本并朗读
   * 使用 stripHtmlAndSSML 统一清理文本（与 Web 端对齐）
   */
  private async speakSceneContent(scene: Scene): Promise<void> {
    let textToSpeak = '';

    const slideContent = scene.content as any;
    if (slideContent?.canvas?.elements) {
      const textElements = slideContent.canvas.elements
        .filter((el: any) => el.type === 'text' && el.content)
        .map((el: any) => el.content as string);
      textToSpeak = textElements.join('\n');
    }

    // Use stripHtmlAndSSML for all text (aligned with web)
    if (textToSpeak) {
      await this.speakText(textToSpeak, `tts_s${this.sceneIndex}_scene_${scene.id}`);
    }
  }

  private async speakSceneContentAuto(scene: Scene): Promise<void> {
    await this.speakSceneContent(scene);

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
   * 执行 speech action
   * Audio ID format aligned with web: tts_s{sceneOrder}_{actionId}
   */
  private async executeSpeech(action: SceneAction<'speech'>): Promise<void> {
    const data = action.data as SpeechActionData;
    const text = data.text;

    if (!text) {
      console.warn('[PlaybackEngine] Speech action has no text');
      return;
    }

    const audioId = `tts_s${this.sceneIndex}_${action.id}`;
    await this.speakText(text, audioId);
  }

  private async executeSpeechAuto(action: SceneAction<'speech'>): Promise<void> {
    await this.executeSpeech(action);

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
   * 5秒后自动清除（与 Web 端对齐）
   */
  private executeSpotlight(action: SceneAction): void {
    const data = action.data as SpotlightActionData;
    const elementId = data.target_element_id;
    const dimness = data.dim_opacity ?? 0.7;

    if (!elementId) {
      console.warn('[PlaybackEngine] Spotlight action has no target_element_id');
      return;
    }

    this.callbacks.onSpotlight?.(elementId, dimness);
    this.scheduleEffectClear();
  }

  /**
   * 执行 laser action（非阻塞）
   * 5秒后自动清除（与 Web 端对齐）
   */
  private executeLaser(action: SceneAction): void {
    const data = action.data as LaserActionData;
    const elementId = data.target_element_id || action.id;
    const color = data.color || '#ff3b30';

    if (!elementId) {
      console.warn('[PlaybackEngine] Laser action has no target');
      return;
    }

    this.callbacks.onLaser?.(elementId, color);
    this.scheduleEffectClear();
  }

  /**
   * Clear effects and cancel pending timer (aligned with web ActionEngine.clearEffects)
   */
  private clearEffects(): void {
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
    }
    this.callbacks.onClearEffects?.();
  }

  /**
   * Schedule auto-clear for fire-and-forget effects (5s, aligned with web)
   */
  private scheduleEffectClear(): void {
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
    }
    this.effectTimer = setTimeout(() => {
      this.callbacks.onClearEffects?.();
      this.effectTimer = null;
    }, EFFECT_AUTO_CLEAR_MS);
  }

  /**
   * 播放文本（TTS API 或 expo-speech fallback）
   * Strip HTML/SSML tags and use scene-specific cache keys
   */
  private async speakText(text: string, audioId: string): Promise<void> {
    const cleanText = stripHtmlAndSSML(text);

    if (!cleanText || cleanText.length < 2) {
      console.warn('[PlaybackEngine] Text too short after stripping HTML, skip TTS');
      return;
    }

    const cacheKey = `${audioId}_${this.ttsConfig.provider}_${this.ttsConfig.voice}_${this.ttsConfig.speed}`;

    // 1. Check memory cache
    const memoryCached = this.audioCache.get(cacheKey);
    if (memoryCached) {
      this.audioPlayer.cacheAudio(cacheKey, memoryCached.base64, memoryCached.format);
      await this.audioPlayer.play(cacheKey, memoryCached.format);
      return;
    }

    // 2. Check file system cache (native only)
    if (Platform.OS !== 'web') {
      const filePath = getAudioPath(cacheKey);
      if (filePath) {
        try {
          const { File } = require('expo-file-system');
          const file = new File(filePath);
          const base64 = file.base64Sync();
          // Determine format from file extension
          const format = filePath.endsWith('.wav') ? 'wav' : 'mp3';
          this.audioCache.set(cacheKey, { base64, format });
          this.audioPlayer.cacheAudio(cacheKey, base64, format);
          await this.audioPlayer.play(cacheKey, format);
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
          cleanText,
          audioId,
          this.ttsConfig.provider,
          this.ttsConfig.voice,
          this.ttsConfig.speed,
          this.ttsConfig.model,
          this.ttsConfig.provider === 'voxcpm' ? {
            backend: this.ttsConfig.backend,
            voicePrompt: this.ttsConfig.voicePrompt,
          } : undefined,
        );

        if (result.success && result.base64) {
          this.audioCache.set(cacheKey, { base64: result.base64, format: result.format });
          this.audioPlayer.cacheAudio(cacheKey, result.base64, result.format);

          // Native: save to file system for persistent caching
          if (Platform.OS !== 'web') {
            saveAudioFile(cacheKey, result.base64, result.format);
          }

          this.callbacks.onTTSReady?.(cacheKey);
          await this.audioPlayer.play(cacheKey, result.format);
          return;
        }
      } catch (err) {
        console.warn('[PlaybackEngine] TTS API failed:', err);
      }
    }

    // 4. expo-speech fallback
    this.speechPlaying = true;
    try {
      await Speech.speak(cleanText, {
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

  async dispose(): Promise<void> {
    this.clearEffects();
    await this.audioPlayer.dispose();
    Speech.stop();
    this.mode = 'idle';
    this.speechPlaying = false;
  }
}
