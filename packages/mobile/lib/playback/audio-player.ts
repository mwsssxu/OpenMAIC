/**
 * Audio Player - 使用 expo-av 播放音频文件
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { getAudioPath } from '../storage/audio-storage';

export type AudioPlayerCallback = {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
};

// 权限状态缓存
let audioPermissionGranted = false;
let audioModeSetup = false;

/**
 * 请求音频播放权限并设置音频模式
 */
async function ensureAudioReady(): Promise<boolean> {
  if (audioPermissionGranted && audioModeSetup) return true;

  try {
    // 请求权限
    if (!audioPermissionGranted) {
      const { status } = await Audio.requestPermissionsAsync();
      audioPermissionGranted = status === 'granted';
      if (!audioPermissionGranted) {
        console.error('[AudioPlayer] Audio permission not granted');
        return false;
      }
    }

    // 设置音频模式
    if (!audioModeSetup) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      audioModeSetup = true;
    }

    return true;
  } catch (error) {
    console.error('[AudioPlayer] Audio setup failed:', error);
    return false;
  }
}

/**
 * 音频播放器
 */
export class AudioPlayer {
  private sound: Audio.Sound | null = null;
  private playing: boolean = false;
  private callbacks: AudioPlayerCallback = {};

  constructor(callbacks?: AudioPlayerCallback) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * 播放音频
   *
   * @param audioId - 音频 ID（已存储的文件名）
   * @param format - 音频格式 (mp3, wav 等)，默认 mp3
   * @returns 是否成功开始播放
   */
  async play(audioId: string, format: string = 'mp3'): Promise<boolean> {
    // 确保音频权限和模式已设置
    const ready = await ensureAudioReady();
    if (!ready) {
      this.callbacks.onError?.(new Error('Audio permission not granted'));
      return false;
    }

    // 尝试多种格式查找音频文件
    const formatsToTry = [format, 'mp3', 'wav', 'ogg'];
    let path: string | null = null;

    for (const f of formatsToTry) {
      path = getAudioPath(audioId, f);
      if (path) break;
    }

    if (!path) {
      console.warn(`[AudioPlayer] Audio file not found: ${audioId}`);
      return false;
    }

    // 先停止当前播放
    await this.stop();

    try {
      // 加载并播放音频
      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this.playing = true;
      this.callbacks.onPlayStart?.();

      return true;
    } catch (error) {
      console.error(`[AudioPlayer] Failed to play audio: ${audioId}`, error);
      this.callbacks.onError?.(error as Error);
      return false;
    }
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    if (this.sound && this.playing) {
      await this.sound.pauseAsync();
      this.playing = false;
    }
  }

  /**
   * 继续播放
   */
  async resume(): Promise<void> {
    if (this.sound && !this.playing) {
      await this.sound.playAsync();
      this.playing = true;
    }
  }

  /**
   * 停止播放并释放资源
   */
  async stop(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
    this.playing = false;
  }

  /**
   * 是否正在播放
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * 获取当前播放位置（毫秒）
   */
  async getPositionMillis(): Promise<number> {
    if (!this.sound) return 0;
    const status = await this.sound.getStatusAsync();
    if (status.isLoaded) {
      return status.positionMillis;
    }
    return 0;
  }

  /**
   * 设置播放位置（毫秒）
   */
  async setPositionMillis(positionMillis: number): Promise<void> {
    if (this.sound) {
      await this.sound.setPositionAsync(positionMillis);
    }
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.stop();
  }

  /**
   * 播放状态更新回调
   */
  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
      // 发生错误或未加载
      this.playing = false;
      return;
    }

    this.playing = status.isPlaying;

    // 播放完成
    if (status.didJustFinish) {
      this.playing = false;
      this.callbacks.onPlayEnd?.();
    }
  };
}