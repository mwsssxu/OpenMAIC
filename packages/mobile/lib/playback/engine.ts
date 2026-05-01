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
import { saveAudioFile } from '../storage/audio-storage';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Scene, SceneAction, SpeechActionData, SpotlightActionData, LaserActionData } from '../types';
import { apiClient } from '../api-client';

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
  onSceneChange?: (index: number, scene: Scene) => void;
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
    // 清除缓存，使用新配置重新生成
    this.audioCache.clear();
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
   */
  async playCurrentScene(): Promise<void> {
    const scene = this.getCurrentScene();
    if (!scene) {
      return;
    }

    // 检查场景类型
    if (NON_SPEECH_SCENE_TYPES.includes(scene.type)) {
      // 互动/测验/PBL 场景不播放音频
      console.log(`[PlaybackEngine] Skipping speech for ${scene.type} scene`);
      return;
    }

    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);
    this.actionIndex = 0;

    await this.processSceneActions(scene);
  }

  /**
   * 处理场景的所有 actions
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

    // 处理所有 actions
    // spotlight/laser 是非阻塞的，speech 是阻塞的
    for (const action of actions) {
      this.callbacks.onActionExecute?.(action);

      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
        // 非阻塞，立即继续
      } else if (action.type === 'laser') {
        this.executeLaser(action);
        // 非阻塞，立即继续
      } else if (action.type === 'speech') {
        // speech 是阻塞的，等待完成
        await this.executeSpeech(action as SceneAction<'speech'>);
        return;
      }
    }
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
      return;
    }

    const actions = scene.actions || [];

    if (actions.length === 0) {
      await this.speakSceneContentAuto(scene);
      return;
    }

    // 先清除之前的视觉效果
    this.callbacks.onClearEffects?.();

    // 处理所有 actions（spotlight/laser 非阻塞）
    for (const action of actions) {
      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
      } else if (action.type === 'laser') {
        this.executeLaser(action);
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
   */
  private async speakSceneContent(scene: Scene): Promise<void> {
    let textToSpeak = '';

    if (scene.content?.canvas?.elements) {
      const textElements = scene.content.canvas.elements
        .filter((el) => el.type === 'text' && el.content)
        .map((el) => el.content as string);
      textToSpeak = textElements.join('\n');
    } else if (scene.content?.text) {
      textToSpeak = scene.content.text;
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
   */
  private async speakText(text: string, audioId: string): Promise<void> {
    // 1. 检查缓存（使用文本长度和更多字符避免碰撞）
    const cacheKey = `${this.ttsConfig.provider}_${this.ttsConfig.voice}_${text.length}_${text.slice(0, 100)}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      // Web 环境：直接缓存到 AudioPlayer
      if (Platform.OS === 'web') {
        this.audioPlayer.cacheAudio(audioId, cached.base64, cached.format);
      } else {
        saveAudioFile(audioId, cached.base64, cached.format);
      }
      await this.audioPlayer.play(audioId, cached.format);
      return;
    }

    // 2. 请求 TTS API
    if (this.ttsConfig.provider !== 'browser') {
      try {
        this.callbacks.onTTSGenerate?.(audioId);

        const result = await apiClient.generateTTS(
          text,
          audioId,
          this.ttsConfig.provider,
          this.ttsConfig.voice,
          this.ttsConfig.speed,
          this.ttsConfig.model,
          // VoxCPM 特有配置
          this.ttsConfig.provider === 'voxcpm' ? {
            backend: this.ttsConfig.backend,
            voicePrompt: this.ttsConfig.voicePrompt,
          } : undefined,
        );

        if (result.success && result.base64) {
          // 缓存音频数据
          this.audioCache.set(cacheKey, { base64: result.base64, format: result.format });

          // Web 环境：直接缓存 base64 到 AudioPlayer，无需文件存储
          if (Platform.OS === 'web') {
            this.audioPlayer.cacheAudio(result.audioId, result.base64, result.format);
          } else {
            // Native 环境：保存到文件系统
            saveAudioFile(result.audioId, result.base64, result.format);
          }

          this.callbacks.onTTSReady?.(result.audioId);
          await this.audioPlayer.play(result.audioId, result.format);
          return;
        }
      } catch (err) {
        console.warn('[PlaybackEngine] TTS API failed:', err);
      }
    }

    // 3. expo-speech fallback
    this.speechPlaying = true;
    try {
      await Speech.speak(text, {
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