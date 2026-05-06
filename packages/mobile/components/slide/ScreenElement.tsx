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
  theme: SlideTheme;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * ScreenElement Component
 *
 * Renders the appropriate element component based on element type
 */
export function ScreenElement({ element, theme, scaleX, scaleY }: ScreenElementProps) {
  // Render based on element type
  switch (element.type) {
    case 'text':
      return <TextElement element={element} theme={theme} scaleX={scaleX} scaleY={scaleY} />;

    case 'image':
      return <ImageElement element={element} scaleX={scaleX} scaleY={scaleY} />;

    case 'shape':
      return <ShapeElement element={element} theme={theme} scaleX={scaleX} scaleY={scaleY} />;

    case 'line':
      return <LineElement element={element} scaleX={scaleX} scaleY={scaleY} />;

    case 'video':
      return <VideoElement element={element} scaleX={scaleX} scaleY={scaleY} />;

    default:
      // Unknown type - render placeholder
      return null;
  }
}