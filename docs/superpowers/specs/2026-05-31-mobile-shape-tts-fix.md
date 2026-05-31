---
name: mobile-shape-tts-fix
description: Fix shape rendering misalignment and TTS voice generation issues in mobile app
---

# Mobile Shape Rendering & TTS Fix Design

## Problem Statement

Two issues need to be fixed in the mobile app:

1. **Shape Rendering Misalignment**: When displaying shapes with vertices (e.g., angle shapes with two edges), the edges are misaligned. The root cause is that `ShapeElement.tsx` does not render SVG paths - it only uses a `View` with `backgroundColor`, which ignores the actual shape geometry.

2. **TTS Voice Generation Issues**:
   - Always generates voice for the first scene regardless of current scene
   - Loops continuously without stopping
   - HTML/SSML tags (e.g., `<break time="500ms"/>`) are not stripped from TTS text
   - No persistent caching - regenerates TTS every time
   - Spotlight effect not showing during TTS playback

---

## Solution Design

### Part 1: Shape Rendering Fix

#### Approach: Use react-native-svg for Path Rendering

Align with web implementation by using `react-native-svg` to render actual SVG paths.

**Files to modify:**

1. `packages/mobile/components/slide/ShapeElement.tsx`
   - Replace `View` with `Svg` and `Path` from `react-native-svg`
   - Implement `viewBox` transformation like web version
   - Support fill, stroke, and gradient

2. `packages/mobile/components/slide/LineElement.tsx`
   - Use `Svg` with proper `Line` or `Path` element
   - Fix start point offset issue

**Implementation details:**

```typescript
// ShapeElement.tsx - new implementation
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export function ShapeElement({ element, scaleX, scaleY, isWhiteboard }) {
  const width = (element.width || 100) * scaleX;
  const height = (element.height || 100) * scaleY;

  // Scale path using viewBox ratio (like web)
  const viewBoxWidth = element.viewBox?.[0] || element.width || 100;
  const viewBoxHeight = element.viewBox?.[1] || element.height || 100;
  const scaleRatioX = width / viewBoxWidth;
  const scaleRatioY = height / viewBoxHeight;

  return (
    <View style={[containerStyle, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
        <Path
          d={element.path}
          fill={element.fill || '#5b9bd5'}
          stroke={element.outlineColor || 'transparent'}
          strokeWidth={element.outlineWidth || 0}
        />
      </Svg>
      {/* Text content overlay */}
    </View>
  );
}
```

```typescript
// LineElement.tsx - fix start offset
export function LineElement({ element, scaleX, scaleY, isWhiteboard }) {
  const startX = element.start[0];
  const startY = element.start[1];
  const endX = element.end[0];
  const endY = element.end[1];

  // Calculate SVG dimensions to contain both points
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const svgWidth = Math.abs(endX - startX);
  const svgHeight = Math.abs(endY - startY);

  // Adjust path to start from (0,0) within SVG
  const adjustedStartX = startX - minX;
  const adjustedStartY = startY - minY;
  const adjustedEndX = endX - minX;
  const adjustedEndY = endY - minY;

  return (
    <View style={{ position: 'absolute', left: (element.left + minX) * scaleX, top: (element.top + minY) * scaleY }}>
      <Svg width={svgWidth * avgScale} height={svgHeight * avgScale}>
        <Line
          x1={adjustedStartX * avgScale}
          y1={adjustedStartY * avgScale}
          x2={adjustedEndX * avgScale}
          y2={adjustedEndY * avgScale}
          stroke={element.color}
          strokeWidth={2 * avgScale}
        />
      </Svg>
    </View>
  );
}
```

---

### Part 2: TTS Voice Fix

#### 2.1 Fix Scene Index Issue

**Problem:** TTS always uses first scene content.

**Root cause analysis:**
- `playCurrentScene()` correctly uses `this.getCurrentScene()`
- `sceneIndex` is updated by `jumpToScene()`, `nextScene()`, `prevScene()`
- Need to verify `sceneIndex` is correct when play button is pressed

**Fix:** Add logging and ensure `sceneIndex` is passed correctly to TTS generation.

#### 2.2 Prevent TTS Looping

**Problem:** TTS loops continuously.

**Root cause analysis:**
- `playCurrentScene()` should not loop - it plays current scene only
- Check if `autoPlayEnabled` is causing repeated calls
- Check if `onPlayEnd` callback triggers re-play

**Fix:**
```typescript
// In engine.ts - add guard to prevent re-entry
async playCurrentScene(): Promise<void> {
  if (this.mode === 'playing' || this.processing) {
    console.log('[PlaybackEngine] Already playing, skip');
    return;
  }
  // ... rest of implementation
}
```

#### 2.3 Strip HTML/SSML Tags from TTS Text

**Problem:** TTS text contains `<break time="500ms"/>` and other tags.

**Fix:** Add client-side HTML stripping before sending to TTS API.

```typescript
// In engine.ts - add stripHtml function
function stripHtmlAndSSML(text: string): string {
  // Remove SSML tags
  let cleaned = text.replace(/<(break|speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)[^>]*>|<\/(speak|p|s|phoneme|emphasis|prosody|say-as|sub|voice)>/gi, '');
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  // Clean up whitespace
  return cleaned.trim().replace(/\s+/g, ' ');
}

// Use in speakText()
const cleanText = stripHtmlAndSSML(text);
```

#### 2.4 Persistent TTS Caching

**Problem:** TTS regenerated every time, no persistent cache.

**Fix:** Use file system storage for TTS audio (already exists in `audio-storage.ts`).

```typescript
// In engine.ts - enhance caching
private async speakText(text: string, audioId: string): Promise<void> {
  const cleanText = stripHtmlAndSSML(text);

  // Generate cache key with scene index
  const sceneIndex = this.sceneIndex;
  const cacheKey = `tts_s${sceneIndex}_${audioId}_${this.ttsConfig.provider}_${this.ttsConfig.voice}_${this.ttsConfig.speed}`;

  // 1. Check memory cache
  const memoryCached = this.audioCache.get(cacheKey);
  if (memoryCached) {
    await this.playFromCache(memoryCached, audioId);
    return;
  }

  // 2. Check file system cache (native only)
  if (Platform.OS !== 'web') {
    const filePath = await getAudioPath(cacheKey);
    if (filePath) {
      await this.audioPlayer.playFromFile(filePath);
      return;
    }
  }

  // 3. Generate new TTS
  const result = await apiClient.generateTTS(cleanText, cacheKey, ...);

  // 4. Save to both caches
  this.audioCache.set(cacheKey, { base64: result.base64, format: result.format });
  if (Platform.OS !== 'web') {
    await saveAudioFile(cacheKey, result.base64, result.format);
  }

  await this.audioPlayer.play(cacheKey, result.format);
}
```

#### 2.5 Spotlight Effect During TTS

**Problem:** Spotlight not showing during TTS playback.

**Analysis:**
- `SpotlightOverlay` component exists
- `onSpotlight` callback is wired in classroom page
- Need to verify `spotlight` action is processed before `speech` action

**Fix:** Ensure spotlight action is executed before speech in `processSceneActions()`.

```typescript
// In engine.ts - processSceneActions already handles this correctly
// spotlight is non-blocking, speech is blocking
// Just need to verify the order in scene data
```

---

## Implementation Plan

### Phase 1: Shape Rendering (Priority: High)

1. Add `react-native-svg` dependency if not already present
2. Rewrite `ShapeElement.tsx` to use SVG Path
3. Rewrite `LineElement.tsx` to use SVG Line
4. Test with the problematic course (classroom/0ef735c3-...)

### Phase 2: TTS Fixes (Priority: High)

1. Add `stripHtmlAndSSML()` function to engine.ts
2. Fix scene index tracking in TTS generation
3. Add guard to prevent TTS looping
4. Enhance caching with scene-specific keys
5. Verify spotlight effect triggers correctly

### Phase 3: Testing

1. Test shape rendering with various shape types
2. Test TTS playback across multiple scenes
3. Test TTS caching persistence (restart app)
4. Test spotlight effect during playback

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/mobile/components/slide/ShapeElement.tsx` | Rewrite to use SVG Path |
| `packages/mobile/components/slide/LineElement.tsx` | Fix start offset, use SVG |
| `packages/mobile/lib/playback/engine.ts` | Add HTML stripping, fix caching, prevent loop |
| `packages/mobile/lib/storage/audio-storage.ts` | May need cache key format update |

---

## Dependencies

- `react-native-svg` - for SVG rendering (check if already installed)

---

## Success Criteria

1. Shapes with vertices (angles, triangles, arrows) render correctly
2. TTS plays content for current scene, not first scene
3. TTS stops after playing current scene (no loop)
4. HTML/SSML tags are stripped from TTS text
5. TTS audio is cached persistently
6. Spotlight effect shows during TTS playback
