/**
 * Slide Components Index
 *
 * Export all slide rendering components for mobile
 */

// Main canvas components
export { ScreenCanvas } from './ScreenCanvas';
export { ScreenElement } from './ScreenElement';

// Layout components
export { SimplifiedLayout } from './SimplifiedLayout';
export { SimplifiedTextElement } from './SimplifiedTextElement';

// Element renderers
export { TextElement } from './TextElement';
export { ImageElement } from './ImageElement';
export { ShapeElement } from './ShapeElement';
export { LineElement } from './LineElement';
export { VideoElement } from './VideoElement';

// Overlay components
export { SpotlightOverlay } from './SpotlightOverlay';
export { LaserOverlay } from './LaserOverlay';

// Types
export * from './types';

// Constants
export * from './constants';

// Hooks
export { useViewportSize, useSlideBackgroundStyle, parseHtmlToText, extractFontSizeFromHtml } from './hooks/useViewportSize';

// Utils
export { detectLayoutMode, getElementPosition, LayoutMode } from './utils/layout-detection';
export { getTextHeight, calculateLineCount, getAutoBackgroundColor, TEXT_HEIGHT_TABLE, AUTO_BACKGROUND_COLORS } from './utils/text-height-table';