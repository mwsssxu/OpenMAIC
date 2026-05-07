/**
 * SpotlightOverlay - Web端聚焦效果
 *
 * 使用SVG mask实现聚光灯效果
 */

import { useMemo } from 'react';

interface SpotlightOverlayProps {
  /** Target element geometry (viewport coordinates) */
  geometry: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;
  /** Background dimming opacity (0-1) */
  dimness?: number;
  /** Scale factors */
  scaleX: number;
  scaleY: number;
  /** Padding offset from parent container */
  paddingTop?: number;
}

export function SpotlightOverlay({
  geometry,
  canvasWidth,
  canvasHeight,
  dimness = 0.7,
  scaleX,
  scaleY,
  paddingTop = 56, // pt-14 = 56px
}: SpotlightOverlayProps) {
  // Calculate scaled position with padding offset
  const scaledX = useMemo(() => (geometry.centerX - geometry.width / 2) * scaleX, [geometry, scaleX]);
  const scaledY = useMemo(() => (geometry.centerY - geometry.height / 2) * scaleY - paddingTop, [geometry, scaleY, paddingTop]);
  const scaledWidth = useMemo(() => geometry.width * scaleX, [geometry, scaleX]);
  const scaledHeight = useMemo(() => geometry.height * scaleY, [geometry, scaleY]);

  // Expand cutout slightly for padding
  const padding = 8;
  const cutoutX = scaledX - padding;
  const cutoutY = scaledY - padding;
  const cutoutW = scaledWidth + padding * 2;
  const cutoutH = scaledHeight + padding * 2;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasWidth}
      height={canvasHeight}
      style={{ zIndex: 10, top: 32, left: 32 }} // p-8 offset
    >
      <defs>
        <mask id="spotlight-mask">
          {/* White = visible, Black = hidden */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Cutout area (black = transparent) */}
          <rect
            x={cutoutX}
            y={cutoutY}
            width={cutoutW}
            height={cutoutH}
            fill="black"
            rx="4"
            ry="4"
          />
        </mask>
      </defs>

      {/* Dimmed background with mask */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill={`rgba(0,0,0,${dimness})`}
        mask="url(#spotlight-mask)"
      />

      {/* White border highlight */}
      <rect
        x={cutoutX - 1.5}
        y={cutoutY - 1.5}
        width={cutoutW + 3}
        height={cutoutH + 3}
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.5"
        rx="5"
        ry="5"
      />
    </svg>
  );
}