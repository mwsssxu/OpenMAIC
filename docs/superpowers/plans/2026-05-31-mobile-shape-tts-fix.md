# Mobile Shape Rendering & TTS Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix shape rendering misalignment and TTS voice generation issues in the mobile app.

**Architecture:** Use `react-native-svg` to render SVG paths for shapes and lines (aligning with web implementation). Fix TTS to use scene-specific audio IDs, strip HTML/SSML tags, implement persistent caching, and prevent looping.

**Tech Stack:** React Native, react-native-svg, expo-file-system, expo-av

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/mobile/package.json` | Modify | Add react-native-svg dependency |
| `packages/mobile/components/slide/ShapeElement.tsx` | Rewrite | Use SVG Path for shape rendering |
| `packages/mobile/components/slide/LineElement.tsx` | Rewrite | Use SVG Path for line rendering |
| `packages/mobile/lib/playback/engine.ts` | Modify | Add HTML stripping, fix caching, prevent loop |
| `packages/mobile/lib/storage/audio-storage.ts` | Modify | Add cache key format with scene index |
| `packages/mobile/lib/utils/html-stripper.ts` | Create | HTML/SSML tag stripping utility |

---

## Task 1: Add react-native-svg Dependency

**Files:**
- Modify: `packages/mobile/package.json`

- [ ] **Step 1: Install react-native-svg**

Run:
```bash
cd /Users/xuning/workspace/project/git/ml/OpenMAIC/packages/mobile && npx expo install react-native-svg
```

Expected: Package added to package.json and podfile updated (iOS)

- [ ] **Step 2: Verify installation**

Run:
```bash
grep "react-native-svg" /Users/xuning/workspace/project/git/ml/OpenMAIC/packages/mobile/package.json
```

Expected: `"react-native-svg": "15.x.x"` (version may vary)

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/package.json
git commit -m "feat(mobile): add react-native-svg dependency for shape rendering"
```

---

## Task 2: Create HTML/SSML Stripper Utility

**Files:**
- Create: `packages/mobile/lib/utils/html-stripper.ts`

- [ ] **Step 1: Create the utility file**

```typescript
/**
 * HTML/SSML Stripper - Remove HTML and SSML tags from text
 *
 * Used to clean TTS text before sending to speech API
 */

/**
 * SSML tags that should be removed from TTS text
 * Includes: break, speak, p, s, phoneme, emphasis, prosody, say-as, sub, voice
 */
const SSML_TAG_PATTERN = /<(break|speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)[^>]*>|<\/(speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)>/gi;

/**
 * General HTML tag pattern
 */
const HTML_TAG_PATTERN = /<[^>]+>/g;

/**
 * Strip HTML and SSML tags from text
 *
 * @param text - Input text that may contain HTML/SSML tags
 * @returns Cleaned text with all tags removed
 *
 * @example
 * stripHtmlAndSSML('Hello <break time="500ms"/>world!')
 * // Returns: 'Hello world!'
 *
 * stripHtmlAndSSML('<p>Hello</p> <b>world</b>!')
 * // Returns: 'Hello world!'
 */
export function stripHtmlAndSSML(text: string): string {
  if (!text) return '';

  // First remove SSML tags (they may have attributes)
  let cleaned = text.replace(SSML_TAG_PATTERN, '');

  // Then remove any remaining HTML tags
  cleaned = cleaned.replace(HTML_TAG_PATTERN, '');

  // Clean up whitespace: multiple spaces -> single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Check if text contains SSML tags
 *
 * @param text - Input text
 * @returns true if SSML tags are present
 */
export function containsSSML(text: string): boolean {
  return SSML_TAG_PATTERN.test(text);
}

/**
 * Check if text contains HTML tags
 *
 * @param text - Input text
 * @returns true if HTML tags are present
 */
export function containsHtml(text: string): boolean {
  return HTML_TAG_PATTERN.test(text);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/lib/utils/html-stripper.ts
git commit -m "feat(mobile): add HTML/SSML stripper utility for TTS text"
```

---

## Task 3: Rewrite ShapeElement with SVG Path Rendering

**Files:**
- Modify: `packages/mobile/components/slide/ShapeElement.tsx`

- [ ] **Step 1: Rewrite ShapeElement to use react-native-svg**

Replace entire file content with:

```typescript
/**
 * ShapeElement - Shape element renderer for Mobile
 *
 * Uses react-native-svg to render SVG paths (aligned with web implementation)
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import type { PPTShapeElement, SlideTheme } from './types';
import { parseHtmlToText } from './hooks/useViewportSize';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface ShapeElementProps {
  element: PPTShapeElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

export function ShapeElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: ShapeElementProps) {
  // Calculate actual dimensions
  const width = (element.width || 100) * scaleX;
  const height = (element.height || 100) * scaleY;
  const left = (element.left || 0) * scaleX;
  const top = (element.top || 0) * scaleY;

  // Get viewBox dimensions for scaling
  const viewBoxWidth = element.viewBox?.[0] || element.width || 100;
  const viewBoxHeight = element.viewBox?.[1] || element.height || 100;

  // Calculate scale ratios for path transformation
  const scaleRatioX = width / viewBoxWidth;
  const scaleRatioY = height / viewBoxHeight;

  // Determine fill color or gradient
  const fill = useMemo(() => {
    if (element.gradient) {
      // Return gradient ID reference
      return `url(#gradient-${element.id})`;
    }
    return element.fill || '#5b9bd5';
  }, [element]);

  // Outline properties
  const outlineWidth = element.outline?.width || 0;
  const outlineColor = element.outline?.color || 'transparent';
  const strokeDashArray = element.outline?.style === 'dashed' ? '5,3' : undefined;

  // Container style
  const containerStyle = useMemo(() => {
    if (isWhiteboard) {
      return {
        width: '100%' as const,
        minHeight: Math.max(40, height),
        marginBottom: 8,
        opacity: element.opacity || 1,
        zIndex: 0,
      };
    }
    return {
      position: 'absolute' as const,
      top,
      left,
      width,
      height,
      transform: [{ rotate: `${element.rotate || 0}deg` }],
      opacity: element.opacity || 1,
      zIndex: 0,
    };
  }, [element, left, top, width, height, isWhiteboard]);

  // Flip transform for the SVG
  const flipTransform = useMemo(() => {
    const transforms: Array<{ scaleX: number } | { scaleY: number }> = [];
    if (element.flipH) transforms.push({ scaleX: -1 });
    if (element.flipV) transforms.push({ scaleY: -1 });
    return transforms;
  }, [element]);

  // Text content if shape has text
  const textContent = useMemo(() => {
    if (!element.text) return null;
    return parseHtmlToText(element.text.content);
  }, [element]);

  // Text style
  const textStyle = useMemo(() => ({
    color: element.text?.defaultColor || theme.fontColor,
    fontFamily: element.text?.defaultFontName || theme.fontName,
    fontSize: sFont(14, isSmallScreen ? 9 : 11),
    lineHeight: sFont(14, isSmallScreen ? 9 : 11) * 1.4,
    textAlign: 'center' as const,
  }), [element, theme]);

  // Text container alignment
  const textContainerStyle = useMemo(() => {
    const justifyContent = element.text?.align === 'top' ? 'flex-start' :
                          element.text?.align === 'bottom' ? 'flex-end' : 'center';
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: justifyContent as 'flex-start' | 'flex-end' | 'center',
      alignItems: 'center' as const,
      padding: 8 * Math.min(scaleX, scaleY),
    };
  }, [element, scaleX, scaleY]);

  // Gradient definition if present
  const gradientDef = useMemo(() => {
    if (!element.gradient) return null;

    const stops = element.gradient.colors.map((c, i) => (
      <Stop
        key={i}
        offset={c.pos.toString()}
        stopColor={c.color}
      />
    ));

    // Calculate gradient rotation
    const rotate = element.gradient.rotate || 0;
    const angle = (rotate * Math.PI) / 180;
    const x1 = 0.5 - 0.5 * Math.cos(angle);
    const y1 = 0.5 - 0.5 * Math.sin(angle);
    const x2 = 0.5 + 0.5 * Math.cos(angle);
    const y2 = 0.5 + 0.5 * Math.sin(angle);

    return (
      <Defs>
        <LinearGradient
          id={`gradient-${element.id}`}
          x1={x1.toString()}
          y1={y1.toString()}
          x2={x2.toString()}
          y2={y2.toString()}
        >
          {stops}
        </LinearGradient>
      </Defs>
    );
  }, [element]);

  return (
    <View style={[containerStyle, flipTransform.length > 0 && { transform: flipTransform }]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {gradientDef}
        <Path
          d={element.path}
          fill={fill}
          stroke={outlineColor}
          strokeWidth={outlineWidth / scaleRatioX} // Scale stroke width
          strokeDasharray={strokeDashArray}
        />
      </Svg>
      {textContent && (
        <View style={textContainerStyle}>
          <Text style={textStyle}>{textContent}</Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/components/slide/ShapeElement.tsx
git commit -m "feat(mobile): rewrite ShapeElement to use SVG path rendering"
```

---

## Task 4: Rewrite LineElement with SVG Path Rendering

**Files:**
- Modify: `packages/mobile/components/slide/LineElement.tsx`

- [ ] **Step 1: Rewrite LineElement to use react-native-svg**

Replace entire file content with:

```typescript
/**
 * LineElement - Line element renderer for Mobile
 *
 * Uses react-native-svg to render lines (aligned with web implementation)
 * Handles start point offset correctly
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, Marker, Circle, Polygon } from 'react-native-svg';
import type { PPTLineElement } from './types';

interface LineElementProps {
  element: PPTLineElement;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

/**
 * Generate line path string (aligned with web getLineElementPath)
 */
function getLineElementPath(element: PPTLineElement): string {
  const startArr = Array.isArray(element.start) ? element.start : [0, 0];
  const endArr = Array.isArray(element.end) ? element.end : [100, 100];
  const start = startArr.join(',');
  const end = endArr.join(',');

  // Handle different line types
  if ((element as any).broken) {
    const mid = (element as any).broken.join(',');
    return `M${start} L${mid} L${end}`;
  } else if ((element as any).broken2) {
    const minX = Math.min(startArr[0], endArr[0]);
    const maxX = Math.max(startArr[0], endArr[0]);
    const minY = Math.min(startArr[1], endArr[1]);
    const maxY = Math.max(startArr[1], endArr[1]);
    if (maxX - minX >= maxY - minY) {
      return `M${start} L${(element as any).broken2[0]},${startArr[1]} L${(element as any).broken2[0]},${endArr[1]} ${end}`;
    }
    return `M${start} L${startArr[0]},${(element as any).broken2[1]} L${endArr[0]},${(element as any).broken2[1]} ${end}`;
  } else if ((element as any).curve) {
    const mid = (element as any).curve.join(',');
    return `M${start} Q${mid} ${end}`;
  } else if ((element as any).cubic) {
    const [c1, c2] = (element as any).cubic;
    const p1 = c1.join(',');
    const p2 = c2.join(',');
    return `M${start} C${p1} ${p2} ${end}`;
  }

  return `M${start} L${end}`;
}

export function LineElement({ element, scaleX, scaleY, isWhiteboard = false }: LineElementProps) {
  const startX = element.start[0];
  const startY = element.start[1];
  const endX = element.end[0];
  const endY = element.end[1];

  // Calculate SVG dimensions to contain both points (with minimum size)
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const rawWidth = Math.abs(endX - startX);
  const rawHeight = Math.abs(endY - startY);

  // Ensure minimum dimensions for visibility
  const svgWidth = Math.max(rawWidth, 24);
  const svgHeight = Math.max(rawHeight, 24);

  // Line width (use element.width if available, otherwise default to 2)
  const lineWidth = (element as any).width || 2;
  const avgScale = (scaleX + scaleY) / 2;

  // Dash array based on style
  const lineDashArray = useMemo(() => {
    if (element.style === 'dashed') {
      return lineWidth <= 8 ? `${lineWidth * 5} ${lineWidth * 2.5}` : `${lineWidth * 5} ${lineWidth * 1.5}`;
    }
    if (element.style === 'dotted') {
      return lineWidth <= 8 ? `${lineWidth * 1.8} ${lineWidth * 1.6}` : `${lineWidth * 1.5} ${lineWidth * 1.2}`;
    }
    return undefined;
  }, [element.style, lineWidth]);

  // Generate path
  const path = useMemo(() => getLineElementPath(element), [element]);

  // Container position (add minX/minY to position so the SVG container starts from the min point)
  const containerLeft = (element.left + minX) * scaleX;
  const containerTop = (element.top + minY) * scaleY;

  // Adjust path coordinates to be relative to SVG viewBox (offset by minX, minY)
  const adjustedPath = useMemo(() => {
    // Replace coordinates in path with adjusted values
    // Path format: Mx,y Lx,y or Mx,y Qcx,cy x,y etc.
    return path.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_, x, y) => {
      const adjX = parseFloat(x) - minX;
      const adjY = parseFloat(y) - minY;
      return `${adjX},${adjY}`;
    });
  }, [path, minX, minY]);

  // Point markers (arrow heads, dots, etc.)
  const hasStartPoint = element.points?.[0] && element.points[0] !== '';
  const hasEndPoint = element.points?.[1] && element.points[1] !== '';

  const markerDefs = useMemo(() => {
    if (!hasStartPoint && !hasEndPoint) return null;

    const markers: React.ReactNode[] = [];

    if (hasStartPoint) {
      const pointType = element.points[0];
      if (pointType === 'dot') {
        markers.push(
          <Marker
            key="start"
            id="start-marker"
            markerWidth={10}
            markerHeight={10}
            refX={5}
            refY={5}
            orient="auto"
          >
            <Circle cx={5} cy={5} r={3} fill={element.color} />
          </Marker>
        );
      } else if (pointType === 'arrow') {
        markers.push(
          <Marker
            key="start"
            id="start-marker"
            markerWidth={10}
            markerHeight={10}
            refX={0}
            refY={5}
            orient="auto"
          >
            <Polygon points="10,0 0,5 10,10" fill={element.color} />
          </Marker>
        );
      }
    }

    if (hasEndPoint) {
      const pointType = element.points[1];
      if (pointType === 'dot') {
        markers.push(
          <Marker
            key="end"
            id="end-marker"
            markerWidth={10}
            markerHeight={10}
            refX={5}
            refY={5}
            orient="auto"
          >
            <Circle cx={5} cy={5} r={3} fill={element.color} />
          </Marker>
        );
      } else if (pointType === 'arrow') {
        markers.push(
          <Marker
            key="end"
            id="end-marker"
            markerWidth={10}
            markerHeight={10}
            refX={10}
            refY={5}
            orient="auto"
          >
            <Polygon points="0,0 10,5 0,10" fill={element.color} />
          </Marker>
        );
      }
    }

    return <Defs>{markers}</Defs>;
  }, [element, hasStartPoint, hasEndPoint]);

  if (isWhiteboard) {
    // Whiteboard: relative container for flow layout
    return (
      <View style={{ width: '100%', minHeight: svgHeight * avgScale + 20, marginBottom: 8, zIndex: 1 }}>
        <View style={{ position: 'absolute', left: (element.left + minX) * scaleX, top: (element.top + minY) * scaleY, zIndex: 1 }}>
          <Svg width={svgWidth * avgScale} height={svgHeight * avgScale} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {markerDefs}
            <Path
              d={adjustedPath}
              stroke={element.color}
              strokeWidth={lineWidth}
              strokeDasharray={lineDashArray}
              fill="none"
              markerStart={hasStartPoint ? 'url(#start-marker)' : undefined}
              markerEnd={hasEndPoint ? 'url(#end-marker)' : undefined}
            />
          </Svg>
        </View>
      </View>
    );
  }

  // Non-whiteboard: absolute positioning
  return (
    <View style={{
      position: 'absolute' as const,
      left: containerLeft,
      top: containerTop,
      zIndex: 1,
    }}>
      <Svg width={svgWidth * avgScale} height={svgHeight * avgScale} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {markerDefs}
        <Path
          d={adjustedPath}
          stroke={element.color}
          strokeWidth={lineWidth}
          strokeDasharray={lineDashArray}
          fill="none"
          markerStart={hasStartPoint ? 'url(#start-marker)' : undefined}
          markerEnd={hasEndPoint ? 'url(#end-marker)' : undefined}
        />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/components/slide/LineElement.tsx
git commit -m "feat(mobile): rewrite LineElement to use SVG path rendering with correct start offset"
```

---

## Task 5: Fix TTS Engine - Add HTML Stripping and Scene-Specific Caching

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts`

- [ ] **Step 1: Add imports for HTML stripper and getAudioPath**

At line 15, update the import:
```typescript
import { AudioPlayer } from './audio-player';
import { saveAudioFile, getAudioPath } from '../storage/audio-storage';
```

At line 18, add import:
```typescript
import { stripHtmlAndSSML } from '../utils/html-stripper';
```

- [ ] **Step 2: Update speakText method to use scene-specific cache keys and HTML stripping**

Replace the `speakText` method (lines 508-579) with:

```typescript
  /**
   * 播放文本（TTS API 或 expo-speech fallback）
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
      // Web environment: cache to AudioPlayer
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
        // Load from file and cache to memory
        try {
          const { File } = require('expo-file-system');
          const file = new File(filePath);
          const base64 = file.text({ encoding: 'base64' });
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/playback/engine.ts
git commit -m "fix(mobile): add HTML stripping and scene-specific caching for TTS"
```

---

## Task 6: Fix TTS Engine - Prevent Looping

**Files:**
- Modify: `packages/mobile/lib/playback/engine.ts`

- [ ] **Step 1: Add guard to playCurrentScene to prevent re-entry**

Replace the `playCurrentScene` method (lines 157-175) with:

```typescript
  /**
   * 播放当前场景（不自动切换到下一个）
   */
  async playCurrentScene(): Promise<void> {
    // Guard: prevent re-entry if already playing or processing
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
      // Interactive/quiz/PBL scenes don't play audio
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
```

- [ ] **Step 2: Update processSceneActions to clear processing flag**

Replace the `processSceneActions` method (lines 182-220) with:

```typescript
  /**
   * 处理场景的所有 actions
   * 按顺序执行：spotlight/laser非阻塞立即执行，speech阻塞等待播放完成
   * 白板actions触发白板显示（与Web端对齐）
   */
  private async processSceneActions(scene: Scene): Promise<void> {
    const actions = scene.actions || [];

    if (actions.length === 0) {
      // No actions, extract text from content and speak
      await this.speakSceneContent(scene);
      return;
    }

    // Clear previous visual effects
    this.callbacks.onClearEffects?.();

    // Process all actions in order
    for (const action of actions) {
      // Check if still in playing mode (may have been stopped)
      if (this.mode !== 'playing') {
        console.log('[PlaybackEngine] Playback stopped, exiting processSceneActions');
        return;
      }

      this.callbacks.onActionExecute?.(action);

      if (action.type === 'spotlight') {
        this.executeSpotlight(action);
        // Non-blocking, continue to next action
      } else if (action.type === 'laser') {
        this.executeLaser(action);
        // Non-blocking, continue to next action
      } else if (action.type === 'wb_draw_text' || action.type === 'wb_draw_shape') {
        // Whiteboard draw action - trigger whiteboard display
        this.executeWhiteboard(action);
        // Non-blocking, continue to next action
      } else if (action.type === 'wb_open') {
        // Open whiteboard
        this.callbacks.onWhiteboardOpen?.();
      } else if (action.type === 'wb_clear' || action.type === 'wb_close') {
        // Clear/close whiteboard
        this.callbacks.onClearEffects?.();
      } else if (action.type === 'speech') {
        // Blocking, wait for playback to complete before continuing
        await this.executeSpeech(action as SceneAction<'speech'>);
      }
      // Other action types not handled yet
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/lib/playback/engine.ts
git commit -m "fix(mobile): prevent TTS looping with re-entry guard and mode checks"
```

---

## Task 7: Update Audio Storage for Scene-Specific Cache Keys

**Files:**
- Modify: `packages/mobile/lib/storage/audio-storage.ts`

- [ ] **Step 1: Add function to check if audio exists by pattern**

Add after line 96 (after `getAudioPath` function):

```typescript
/**
 * Check if audio exists for a given pattern (prefix match)
 *
 * @param pattern - Pattern to match (e.g., "tts_s0_" for scene 0)
 * @returns Array of matching audio IDs
 */
export function findAudioByPattern(pattern: string): string[] {
  initAudioStorage();

  const audioDir = getAudioDirectory();
  const files = audioDir.list();

  return files
    .filter(f => f instanceof File && f.name.startsWith(pattern))
    .map(f => (f as File).name.replace(/\.(mp3|wav)$/, ''));
}

/**
 * Clear audio files for a specific scene
 *
 * @param sceneIndex - Scene index to clear
 */
export function clearSceneAudio(sceneIndex: number): void {
  const pattern = `tts_s${sceneIndex}_`;
  const audioIds = findAudioByPattern(pattern);

  for (const audioId of audioIds) {
    deleteAudioFile(audioId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/lib/storage/audio-storage.ts
git commit -m "feat(mobile): add pattern-based audio search for scene-specific cache management"
```

---

## Task 8: Test Shape Rendering

**Files:**
- Test: Manual testing in classroom

- [ ] **Step 1: Start the mobile app**

Run:
```bash
cd /Users/xuning/workspace/project/git/ml/OpenMAIC/packages/mobile && npx expo start
```

- [ ] **Step 2: Navigate to the problematic course**

Open: `http://localhost:8081/classroom/0ef735c3-8ea8-4dc6-a394-b261f390f822?totalScenes=11`

- [ ] **Step 3: Verify shape rendering**

Navigate to the scene with angle/vertex shapes and verify:
- Shapes with vertices (triangles, angles, arrows) render correctly
- Lines are positioned correctly (start point offset fixed)
- No misalignment between shape edges

---

## Task 9: Test TTS Functionality

**Files:**
- Test: Manual testing in classroom

- [ ] **Step 1: Test TTS plays current scene content**

1. Navigate to scene 3 (not the first scene)
2. Click the voice play button
3. Verify the TTS speaks content from scene 3, not scene 0

- [ ] **Step 2: Test TTS does not loop**

1. Click play button
2. Wait for TTS to complete
3. Verify TTS stops after one playback (does not restart)

- [ ] **Step 3: Test HTML/SSML stripping**

1. Play a scene with speech text containing `<break time="500ms"/>`
2. Verify the TTS does not speak the tag literally

- [ ] **Step 4: Test persistent caching**

1. Play TTS on a scene
2. Restart the app
3. Play the same scene again
4. Verify TTS plays immediately (from cache, not regenerated)

- [ ] **Step 5: Test spotlight effect**

1. Play a scene with spotlight action
2. Verify the spotlight overlay appears during TTS playback

---

## Task 10: Final Commit and Cleanup

- [ ] **Step 1: Run lint check**

Run:
```bash
cd /Users/xuning/workspace/project/git/ml/OpenMAIC/packages/mobile && npm run lint
```

- [ ] **Step 2: Fix any lint errors**

If lint errors, fix them and commit.

- [ ] **Step 3: Create summary commit**

```bash
git add -A
git commit -m "fix(mobile): resolve shape rendering and TTS issues

- Use react-native-svg for proper SVG path rendering
- Fix line element start point offset
- Add HTML/SSML tag stripping for TTS text
- Implement scene-specific TTS caching
- Prevent TTS looping with re-entry guards
- Support persistent audio caching across app restarts"
```

---

## Success Criteria

1. ✅ Shapes with vertices (angles, triangles, arrows) render correctly
2. ✅ Lines are positioned correctly (start point offset fixed)
3. ✅ TTS plays content for current scene, not first scene
4. ✅ TTS stops after playing current scene (no loop)
5. ✅ HTML/SSML tags are stripped from TTS text
6. ✅ TTS audio is cached persistently
7. ✅ Spotlight effect shows during TTS playback
