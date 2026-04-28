/**
 * ScreenElement - Element renderer dispatcher for Mobile
 *
 * Dispatches rendering to appropriate element component based on type
 */

import React from 'react';
import { TextElement } from './TextElement';
import { ImageElement } from './ImageElement';
import { ShapeElement } from './ShapeElement';
import { LineElement } from './LineElement';
import { VideoElement } from './VideoElement';
import type { PPTElement, SlideTheme } from './types';

interface ScreenElementProps {
  element: PPTElement;
  index: number;
  theme: SlideTheme;
  /** Scale factor for positioning (React Native doesn't support transformOrigin) */
  scale: number;
}

/**
 * ScreenElement Component
 *
 * Renders the appropriate element component based on element type
 */
export function ScreenElement({ element, index, theme, scale }: ScreenElementProps) {
  // Render based on element type
  switch (element.type) {
    case 'text':
      return <TextElement element={element} theme={theme} scale={scale} />;

    case 'image':
      return <ImageElement element={element} scale={scale} />;

    case 'shape':
      return <ShapeElement element={element} theme={theme} scale={scale} />;

    case 'line':
      return <LineElement element={element} scale={scale} />;

    case 'video':
      return <VideoElement element={element} scale={scale} />;

    default:
      // Unknown type - render placeholder
      return null;
  }
}