/**
 * Playback Engine for Web
 *
 * Processes scene actions (speech, spotlight, laser, wb_draw)
 * Uses Web Speech API or backend TTS for narration
 */

// Types
export type PlaybackMode = 'idle' | 'playing' | 'paused';

export interface Scene {
  id: string;
  type: string;
  title: string;
  order_index: number;
  content: any;
  actions: SceneAction[];
}

export interface SceneAction {
  id: string;
  type: 'speech' | 'spotlight' | 'laser' | 'wb_draw_text' | 'wb_draw_shape' | 'highlight';
  data: Record<string, any>;
}

export interface PlaybackCallbacks {
  onSceneChange?: (index: number, scene: Scene) => void;
  onActionExecute?: (action: SceneAction) => void;
  onComplete?: () => void;
  onModeChange?: (mode: PlaybackMode) => void;
  onError?: (error: Error) => void;
  onSpotlight?: (elementId: string, dimness?: number) => void;
  onLaser?: (elementId: string, color?: string) => void;
  onClearEffects?: () => void;
  onSpeechStart?: (text: string) => void;
  onSpeechEnd?: () => void;
}

// Scene types that don't need speech
const NON_SPEECH_TYPES = ['quiz', 'interactive', 'pbl'];

export class WebPlaybackEngine {
  private scenes: Scene[] = [];
  private sceneIndex: number = 0;
  private mode: PlaybackMode = 'idle';
  private callbacks: PlaybackCallbacks = {};
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private ttsConfig = {
    lang: 'zh-CN',
    rate: 0.9,
    pitch: 1.0,
  };

  constructor(scenes: Scene[], callbacks?: PlaybackCallbacks) {
    this.scenes = scenes;
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.speechSynthesis = window.speechSynthesis;
  }

  getMode(): PlaybackMode {
    return this.mode;
  }

  getSceneIndex(): number {
    return this.sceneIndex;
  }

  getCurrentScene(): Scene | null {
    return this.scenes[this.sceneIndex] || null;
  }

  /**
   * Play current scene (no auto-switch)
   */
  async playCurrentScene(): Promise<void> {
    const scene = this.getCurrentScene();
    if (!scene) return;

    // Skip non-speech scenes
    if (NON_SPEECH_TYPES.includes(scene.type)) {
      console.log(`[WebPlayback] Skipping speech for ${scene.type} scene`);
      return;
    }

    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    await this.processSceneActions(scene);
  }

  /**
   * Process all actions in a scene
   * spotlight/laser are non-blocking (execute immediately, continue)
   * speech is blocking (wait for completion, then continue to next action)
   */
  private async processSceneActions(scene: Scene): Promise<void> {
    const actions = scene.actions || [];

    if (actions.length === 0) {
      // No actions, speak from content
      await this.speakSceneContent(scene);
      return;
    }

    // Clear previous effects
    this.callbacks.onClearEffects?.();

    // Process all actions in order
    for (const action of actions) {
      this.callbacks.onActionExecute?.(action);

      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
        // Non-blocking, continue immediately
      } else if (action.type === 'laser') {
        this.executeLaser(action);
        // Non-blocking, continue immediately
      } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
        // Whiteboard actions - handled separately via whiteboard overlay
        console.log(`[WebPlayback] Whiteboard action: ${action.type}`);
      } else if (action.type === 'speech') {
        // Blocking, wait for speech to complete, then continue
        await this.executeSpeech(action);
      }
    }
  }

  /**
   * Auto-play all scenes
   */
  async startAutoPlay(): Promise<void> {
    if (this.scenes.length === 0) {
      this.callbacks.onComplete?.();
      return;
    }

    this.sceneIndex = 0;
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);
    this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene()!);

    await this.playCurrentSceneAuto();
  }

  /**
   * Auto-play current scene and advance
   */
  private async playCurrentSceneAuto(): Promise<void> {
    if (this.mode !== 'playing') return;

    const scene = this.getCurrentScene();
    if (!scene) return;

    // Skip non-speech scenes
    if (NON_SPEECH_TYPES.includes(scene.type)) {
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

    // Clear previous effects
    this.callbacks.onClearEffects?.();

    for (const action of actions) {
      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
      } else if (action.type === 'laser') {
        this.executeLaser(action);
      } else if (action.type === 'speech') {
        await this.executeSpeechAuto(action);
        return;
      }
    }

    // No speech action, advance to next
    await this.nextScene();
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.mode = 'paused';
    this.callbacks.onModeChange?.(this.mode);

    if (this.speechSynthesis && this.currentUtterance) {
      this.speechSynthesis.pause();
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    this.mode = 'playing';
    this.callbacks.onModeChange?.(this.mode);

    if (this.speechSynthesis) {
      this.speechSynthesis.resume();
    }
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.mode = 'idle';
    this.callbacks.onModeChange?.(this.mode);

    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    this.callbacks.onClearEffects?.();
  }

  /**
   * Next scene (no auto-play)
   */
  async nextScene(): Promise<void> {
    this.stop();

    if (this.sceneIndex < this.scenes.length - 1) {
      this.sceneIndex++;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene()!);
    } else {
      this.callbacks.onComplete?.();
    }
  }

  /**
   * Previous scene (no auto-play)
   */
  async prevScene(): Promise<void> {
    this.stop();

    if (this.sceneIndex > 0) {
      this.sceneIndex--;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene()!);
    }
  }

  /**
   * Jump to scene (no auto-play)
   */
  jumpToScene(index: number): void {
    this.stop();

    if (index >= 0 && index < this.scenes.length) {
      this.sceneIndex = index;
      this.callbacks.onSceneChange?.(this.sceneIndex, this.getCurrentScene()!);
    }
  }

  /**
   * Speak from scene content (fallback when no actions)
   */
  private async speakSceneContent(scene: Scene): Promise<void> {
    let textToSpeak = '';

    if (scene.content?.canvas?.elements) {
      const textElements = scene.content.canvas.elements
        .filter((el: any) => el.type === 'text' && el.content)
        .map((el: any) => {
          // Extract text from HTML content
          const content = el.content;
          if (content.includes('<p')) {
            return content.replace(/<[^>]+>/g, '');
          }
          return content;
        });
      textToSpeak = textElements.join('\n');
    }

    if (textToSpeak && textToSpeak.length > 10) {
      await this.speakText(textToSpeak);
    }
  }

  /**
   * Auto-play version of speakSceneContent
   */
  private async speakSceneContentAuto(scene: Scene): Promise<void> {
    await this.speakSceneContent(scene);

    // After speaking, advance to next scene
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
   * Execute speech action (single scene mode)
   */
  private async executeSpeech(action: SceneAction): Promise<void> {
    const text = action.data?.text || '';
    if (!text) {
      console.warn('[WebPlayback] Speech action has no text');
      return;
    }
    await this.speakText(text);
  }

  /**
   * Execute speech action (auto-play mode)
   */
  private async executeSpeechAuto(action: SceneAction): Promise<void> {
    await this.executeSpeech(action);

    // After speech, advance to next scene
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
   * Execute spotlight action (non-blocking)
   */
  private executeSpotlight(action: SceneAction): void {
    const elementId = action.data?.target_element_id || action.data?.elementId;
    const dimness = action.data?.dim_opacity || action.data?.dimOpacity || 0.7;

    if (!elementId) {
      console.warn('[WebPlayback] Spotlight has no target_element_id');
      return;
    }

    this.callbacks.onSpotlight?.(elementId, dimness);
  }

  /**
   * Execute laser action (non-blocking)
   */
  private executeLaser(action: SceneAction): void {
    const elementId = action.data?.target_element_id || action.data?.elementId;
    const color = action.data?.color || '#ff3b30';

    if (!elementId) {
      console.warn('[WebPlayback] Laser has no target');
      return;
    }

    this.callbacks.onLaser?.(elementId, color);
  }

  /**
   * Speak text using Web Speech API
   */
  private async speakText(text: string): Promise<void> {
    if (!this.speechSynthesis) {
      console.warn('[WebPlayback] Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    this.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.ttsConfig.lang;
    utterance.rate = this.ttsConfig.rate;
    utterance.pitch = this.ttsConfig.pitch;

    this.currentUtterance = utterance;
    this.callbacks.onSpeechStart?.(text);

    return new Promise((resolve) => {
      utterance.onend = () => {
        this.currentUtterance = null;
        this.callbacks.onSpeechEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        console.warn('[WebPlayback] Speech error:', event.error);
        this.currentUtterance = null;
        this.callbacks.onSpeechEnd?.();
        resolve();
      };

      this.speechSynthesis!.speak(utterance);
    });
  }

  /**
   * Set TTS configuration
   */
  setTTSConfig(config: { lang?: string; rate?: number; pitch?: number }): void {
    this.ttsConfig = { ...this.ttsConfig, ...config };
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.stop();
  }
}