/**
 * Audio Player - 使用 expo-av 播放音频文件
 *
 * Web 环境：使用浏览器原生 Audio API，直接播放 base64 音频
 * Native 环境：使用 expo-av 加载文件播放
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';
import { getAudioPath } from '../storage/audio-storage';

export type AudioPlayerCallback = {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
};

// 权限状态缓存
let audioPermissionGranted = false;
let audioModeSetup = false;

// Web 环境：音频缓存（audioId -> { base64, format, url })
const webAudioCache: Map<string, { base64: string; format: string; url?: string }> = new Map();

// Web 环境类型声明
declare global {
  interface Window {
    Audio: new (src?: string) => HTMLAudioElement;
  }
}

/**
 * 请求音频播放权限并设置音频模式（Native only）
 */
async function ensureAudioReady(): Promise<boolean> {
  // Web 环境无需权限
  if (Platform.OS === 'web') return true;

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
  private webAudio: HTMLAudioElement | null = null;
  private webAudioUrl: string | null = null;
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

    // 先停止当前播放
    await this.stop();

    // Web 环境：优先从缓存获取 base64 直接播放
    if (Platform.OS === 'web') {
      return this.playWeb(audioId, format);
    }

    // Native 环境：使用 expo-av 播放文件
    return this.playNative(audioId, format);
  }

  /**
   * Web 环境：使用浏览器原生 Audio API 播放
   * 等待播放完成后再返回
   */
  private async playWeb(audioId: string, format: string): Promise<boolean> {
    // 从缓存获取 base64 音频数据
    const cached = webAudioCache.get(audioId);
    if (!cached) {
      console.warn(`[AudioPlayer] Web: No cached audio for ${audioId}`);
      return false;
    }

    try {
      // 解码 base64 → Blob → Object URL
      const binaryStr = atob(cached.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: `audio/${cached.format || format}` });
      const url = URL.createObjectURL(blob);

      // 创建 Audio 元素并播放（使用 window.Audio 确保 Web 环境可用）
      const audio = new window.Audio(url);
      this.webAudio = audio;
      this.webAudioUrl = url;

      this.playing = true;
      this.callbacks.onPlayStart?.();

      // 使用 Promise 等待播放完成
      return new Promise<boolean>((resolve) => {
        audio.onended = () => {
          this.playing = false;
          this.cleanupWebAudio();
          this.callbacks.onPlayEnd?.();
          resolve(true);
        };

        audio.onerror = () => {
          this.playing = false;
          this.cleanupWebAudio();
          this.callbacks.onError?.(new Error('Web audio playback error'));
          resolve(false);
        };

        audio.play().catch((error) => {
          this.playing = false;
          this.cleanupWebAudio();
          this.callbacks.onError?.(error);
          resolve(false);
        });
      });
    } catch (error) {
      console.error(`[AudioPlayer] Web: Failed to play audio ${audioId}`, error);
      this.callbacks.onError?.(error as Error);
      return false;
    }
  }

  /**
   * Native 环境：使用 expo-av 播放文件
   * 等待播放完成后再返回（使用事件回调，而非轮询）
   */
  private async playNative(audioId: string, format: string): Promise<boolean> {
    // 尝试多种格式查找音频文件
    const formatsToTry = [format, 'mp3', 'wav', 'ogg'];
    let path: string | null = null;

    for (const f of formatsToTry) {
      path = getAudioPath(audioId, f);
      if (path) break;
    }

    if (!path) {
      console.warn(`[AudioPlayer] Native: Audio file not found: ${audioId}`);
      return false;
    }

    try {
      // 加载音频（不使用全局回调）
      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true },
        undefined
      );

      this.sound = sound;
      this.playing = true;
      this.callbacks.onPlayStart?.();

      // 使用 Promise 等待播放完成
      return new Promise<boolean>((resolve) => {
        let resolved = false;

        // 设置超时保护
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            console.warn(`[AudioPlayer] Native: Playback timeout for ${audioId}`);
            resolved = true;
            this.playing = false;
            resolve(false);
          }
        }, 60000);

        // 设置播放状态回调
        sound.setOnPlaybackStatusUpdate((status) => {
          if (resolved) return; // 已解决，忽略后续回调

          if (!status.isLoaded) {
            resolved = true;
            clearTimeout(timeoutId);
            this.playing = false;
            resolve(false);
            return;
          }

          this.playing = status.isPlaying;

          // 播放完成
          if (status.didJustFinish) {
            resolved = true;
            clearTimeout(timeoutId);
            this.playing = false;
            this.callbacks.onPlayEnd?.();
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`[AudioPlayer] Native: Failed to play audio: ${audioId}`, error);
      this.callbacks.onError?.(error as Error);
      return false;
    }
  }

  /**
   * 缓存音频数据（用于 Web 环境直接播放）
   */
  cacheAudio(audioId: string, base64: string, format: string): void {
    webAudioCache.set(audioId, { base64, format });
  }

  /**
   * 清除缓存的音频数据
   */
  clearCache(audioId?: string): void {
    if (audioId) {
      const cached = webAudioCache.get(audioId);
      if (cached?.url) {
        URL.revokeObjectURL(cached.url);
      }
      webAudioCache.delete(audioId);
    } else {
      // 清除所有
      for (const [, cached] of webAudioCache) {
        if (cached.url) {
          URL.revokeObjectURL(cached.url);
        }
      }
      webAudioCache.clear();
    }
  }

  /**
   * 清理 Web Audio 资源
   */
  private cleanupWebAudio(): void {
    if (this.webAudioUrl) {
      URL.revokeObjectURL(this.webAudioUrl);
      this.webAudioUrl = null;
    }
    this.webAudio = null;
  }

  /**
   * 设置播放速率（实时调整，不重新生成音频）
   *
   * @param rate - 播放速率 (0.5 - 2.0)
   */
  async setRate(rate: number): Promise<void> {
    // 确保速率在合理范围内
    const safeRate = Math.max(0.5, Math.min(2.0, rate));

    // Web 环境：使用 HTMLAudioElement.playbackRate
    if (Platform.OS === 'web' && this.webAudio) {
      this.webAudio.playbackRate = safeRate;
    }

    // Native 环境：使用 expo-av 的 setRateAsync
    // 参数：rate, shouldCorrectPitch (可选)
    if (this.sound) {
      await this.sound.setRateAsync(safeRate, true);
    }
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    if (Platform.OS === 'web' && this.webAudio && this.playing) {
      this.webAudio.pause();
      this.playing = false;
    } else if (this.sound && this.playing) {
      await this.sound.pauseAsync();
      this.playing = false;
    }
  }

  /**
   * 继续播放
   */
  async resume(): Promise<void> {
    if (Platform.OS === 'web' && this.webAudio && !this.playing) {
      await this.webAudio.play();
      this.playing = true;
    } else if (this.sound && !this.playing) {
      await this.sound.playAsync();
      this.playing = true;
    }
  }

  /**
   * 停止播放并释放资源
   */
  async stop(): Promise<void> {
    // Web 环境
    if (this.webAudio) {
      this.webAudio.pause();
      this.cleanupWebAudio();
    }

    // Native 环境
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
    if (Platform.OS === 'web' && this.webAudio) {
      return this.webAudio.currentTime * 1000;
    }
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
    if (Platform.OS === 'web' && this.webAudio) {
      this.webAudio.currentTime = positionMillis / 1000;
    } else if (this.sound) {
      await this.sound.setPositionAsync(positionMillis);
    }
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.clearCache();
  }

  /**
   * Native 播放状态更新回调
   */
  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
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