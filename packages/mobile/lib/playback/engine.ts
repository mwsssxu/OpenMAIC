/**
 * Playback Engine - 课堂场景播放引擎
 *
 * 执行场景 Actions（speech, spotlight, laser 等）
 * speech 动作播放 TTS 音频，无音频时使用 expo-speech 作为 fallback
 */

import { AudioPlayer } from './audio-player';
import { saveAudioFile } from '../storage/audio-storage';
import * as Speech from 'expo-speech';
import { Scene, SceneAction, SpeechActionData } from '../types';

export type EngineMode = 'idle' | 'playing' | 'paused';

export type PlaybackEngineCallbacks = {
  onSceneChange?: (index: number, scene: Scene) => void;
  onActionExecute?: (action: SceneAction) => void;
  onComplete?: () => void;
  onModeChange?: (mode: EngineMode) => void;
  onError?: (error: Error) => void;
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

  constructor(scenes: Scene[], callbacks?: PlaybackEngineCallbacks) {
    this.scenes = scenes;
    if (callbacks) {
      this.callbacks = callbacks;
    }

    this.audioPlayer = new AudioPlayer({
      onPlayStart: () => {
        // 音频开始播放
      },
      onPlayEnd: () => {
        // 音频播放完成，继续处理下一个 action
        this.continueProcessing();
      },
      onError: (error) => {
        this.callbacks.onError?.(error);
        // 即使出错也继续处理
        this.continueProcessing();
      },
    });
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
   * 开始播放
   */
  async start(): Promise<void> {
    if (this.scenes.length === 0) {
      this.callbacks.onComplete?.();
      return;
    }

    this.sceneIndex = 0;
    this.actionIndex = 0;
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    // 通知第一个场景
    this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());

    // 开始处理 actions
    this.processNextAction();
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.mode = 'paused';
    this.callbacks.onModeChange?.(this.mode);
    this.audioPlayer.pause();
  }

  /**
   * 继续播放
   */
  resume(): void {
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);
    this.audioPlayer.resume();
  }

  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);
    await this.audioPlayer.stop();
    this.sceneIndex = 0;
    this.actionIndex = 0;
    this.processing = false;
  }

  /**
   * 切换到下一个场景
   */
  async nextScene(): Promise<void> {
    if (this.sceneIndex < this.scenes.length - 1) {
      await this.audioPlayer.stop();
      this.sceneIndex++;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());

      if (this.mode === 'playing') {
        this.processNextAction();
      }
    } else {
      // 已到最后一个场景
      this.mode = 'idle';
      this.callbacks.onModeChange?.(this.mode);
      this.callbacks.onComplete?.();
    }
  }

  /**
   * 切换到上一个场景
   */
  async prevScene(): Promise<void> {
    if (this.sceneIndex > 0) {
      await this.audioPlayer.stop();
      this.sceneIndex--;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());

      if (this.mode === 'playing') {
        this.processNextAction();
      }
    }
  }

  /**
   * 跳转到指定场景
   */
  async jumpToScene(index: number): Promise<void> {
    if (index >= 0 && index < this.scenes.length) {
      await this.audioPlayer.stop();
      this.sceneIndex = index;
      this.actionIndex = 0;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene());

      if (this.mode === 'playing') {
        this.processNextAction();
      }
    }
  }

  /**
   * 处理下一个 action
   */
  private processNextAction(): void {
    if (this.processing) return;
    this.processing = true;

    this.doProcessNext();
  }

  /**
   * 实际处理下一个 action
   */
  private doProcessNext(): void {
    if (this.mode !== 'playing') {
      this.processing = false;
      return;
    }

    const scene = this.getCurrentScene();
    if (!scene) {
      this.processing = false;
      return;
    }

    const actions = scene.actions || [];

    // 如果场景没有 actions，从内容中提取文本并朗读
    if (actions.length === 0) {
      this.speakSceneContent(scene);
      return;
    }

    if (this.actionIndex >= actions.length) {
      // 当前场景的 actions 完成，切换下一个场景
      this.processing = false;
      this.nextScene();
      return;
    }

    const action = actions[this.actionIndex];
    this.actionIndex++;

    this.executeAction(action);
  }

  /**
   * 从场景内容中提取文本并朗读（fallback）
   */
  private async speakSceneContent(scene: Scene): Promise<void> {
    let textToSpeak = '';

    if (scene.content?.canvas?.elements) {
      // 从 canvas elements 中提取文本
      const textElements = scene.content.canvas.elements
        .filter((el) => el.type === 'text' && el.content)
        .map((el) => el.content as string);
      textToSpeak = textElements.join('\n');
    } else if (scene.content?.text) {
      textToSpeak = scene.content.text;
    }

    if (textToSpeak && textToSpeak.length > 10) {
      try {
        await Speech.speak(textToSpeak, {
          language: 'zh-CN',
          rate: 0.9,
          onDone: () => this.moveToNextSceneAfterSpeech(),
          onError: () => this.moveToNextSceneAfterSpeech(),
        });
      } catch {
        this.moveToNextSceneAfterSpeech();
      }
    } else {
      // 没有文本内容，直接切换下一个场景
      this.moveToNextSceneAfterSpeech();
    }
  }

  /**
   * 朗读完成后切换下一个场景
   */
  private moveToNextSceneAfterSpeech(): void {
    this.processing = false;
    this.nextScene();
  }

  /**
   * 执行单个 action
   */
  private async executeAction(action: SceneAction): Promise<void> {
    this.callbacks.onActionExecute?.(action);

    if (action.type === 'speech') {
      await this.executeSpeech(action as SceneAction<'speech'>);
    } else {
      // 其他 action（spotlight, laser 等）- fire and forget
      // 立即继续处理下一个
      this.continueProcessing();
    }
  }

  /**
   * 执行 speech action
   */
  private async executeSpeech(action: SceneAction<'speech'>): Promise<void> {
    const data = action.data as SpeechActionData;
    const audioId = data.audio_id;
    const audioBase64 = data.audio_base64;
    const text = data.text;

    if (audioBase64) {
      // 有 base64 数据，保存并播放
      const generatedId = audioId || `tts_${action.id}`;
      saveAudioFile(generatedId, audioBase64, data.audio_format || 'mp3');
      await this.audioPlayer.play(generatedId);
    } else if (audioId) {
      // 直接播放已存储的音频
      await this.audioPlayer.play(audioId);
    } else if (text) {
      // 使用 expo-speech 作为 fallback
      try {
        await Speech.speak(text, {
          language: 'zh-CN',
          rate: 0.9,
          onDone: () => this.continueProcessing(),
          onError: () => this.continueProcessing(),
        });
      } catch {
        console.warn(`[PlaybackEngine] expo-speech failed for action: ${action.id}`);
        this.continueProcessing();
      }
    } else {
      // 没有 TTS 数据和文本，直接继续
      console.warn(`[PlaybackEngine] Speech action missing audio data and text: ${action.id}`);
      this.continueProcessing();
    }
  }

  /**
   * 继续处理（在音频播放完成后调用）
   */
  private continueProcessing(): void {
    this.processing = false;
    this.doProcessNext();
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.audioPlayer.dispose();
    this.mode = 'idle';
    this.processing = false;
  }
}