/**
 * Slide Components Index
 *
 * Export all slide rendering components for mobile
 */

export { ScreenCanvas } from './ScreenCanvas';
export { ScreenElement } from './ScreenElement';
export { TextElement } from './TextElement';
export { ImageElement } from './ImageElement';
export { ShapeElement } from './ShapeElement';
export { LineElement } from './LineElement';
export { VideoElement } from './VideoElement';
export { SpotlightOverlay } from './SpotlightOverlay';
export { LaserOverlay } from './LaserOverlay';

export * from './types';
export { useViewportSize, useSlideBackgroundStyle, parseHtmlToText, extractFontSizeFromHtml } from './hooks/useViewportSize';