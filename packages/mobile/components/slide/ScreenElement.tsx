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
import { ChartElement } from './ChartElement';
import { LatexElement } from './LatexElement';
import { TableElement } from './TableElement';
import { CodeElement } from './CodeElement';
import type { PPTElement, SlideTheme } from './types';

interface ScreenElementProps {
  element: PPTElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
}

export function ScreenElement({ element, theme, scaleX, scaleY }: ScreenElementProps) {
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
    case 'chart':
      return <ChartElement element={element as any} theme={theme} scaleX={scaleX} scaleY={scaleY} />;
    case 'latex':
      return <LatexElement element={element as any} theme={theme} scaleX={scaleX} scaleY={scaleY} />;
    case 'table':
      return <TableElement element={element as any} theme={theme} scaleX={scaleX} scaleY={scaleY} />;
    case 'code':
      return <CodeElement element={element as any} theme={theme} scaleX={scaleX} scaleY={scaleY} />;
    default:
      return null;
  }
}