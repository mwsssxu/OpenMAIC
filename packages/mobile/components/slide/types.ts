/**
 * Slide Element Types for Mobile
 *
 * Adapted from lib/types/slides.ts for React Native
 */

export const enum ElementTypes {
  TEXT = 'text',
  IMAGE = 'image',
  SHAPE = 'shape',
  LINE = 'line',
  CHART = 'chart',
  TABLE = 'table',
  LATEX = 'latex',
  VIDEO = 'video',
  AUDIO = 'audio',
}

/**
 * Element base properties
 */
interface PPTBaseElement {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
  groupId?: string;
  lock?: boolean;
}

/**
 * Text element
 */
export interface PPTTextElement extends PPTBaseElement {
  type: 'text';
  content: string;
  defaultFontName: string;
  defaultColor: string;
  fill?: string;
  lineHeight?: number;
  wordSpace?: number;
  opacity?: number;
  paragraphSpace?: number;
  vertical?: boolean;
  textType?: string;
}

/**
 * Image element
 */
export interface PPTImageElement extends PPTBaseElement {
  type: 'image';
  src: string;
  fixedRatio: boolean;
  radius?: number;
  flipH?: boolean;
  flipV?: boolean;
  shadow?: { h: number; v: number; blur: number; color: string };
}

/**
 * Shape element
 */
export interface PPTShapeElement extends PPTBaseElement {
  type: 'shape';
  viewBox: [number, number];
  path: string;
  fixedRatio: boolean;
  fill: string;
  gradient?: { type: string; colors: Array<{ pos: number; color: string }>; rotate: number };
  outline?: { style?: string; width?: number; color?: string };
  opacity?: number;
  flipH?: boolean;
  flipV?: boolean;
  text?: {
    content: string;
    defaultFontName: string;
    defaultColor: string;
    align: 'top' | 'middle' | 'bottom';
  };
}

/**
 * Line element
 */
export interface PPTLineElement extends Omit<PPTBaseElement, 'height' | 'rotate'> {
  type: 'line';
  start: [number, number];
  end: [number, number];
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  points: [string, string];
}

/**
 * Video element
 */
export interface PPTVideoElement extends PPTBaseElement {
  type: 'video';
  src: string;
  autoplay: boolean;
  poster?: string;
}

/**
 * All element types union
 */
export type PPTElement =
  | PPTTextElement
  | PPTImageElement
  | PPTShapeElement
  | PPTLineElement
  | PPTVideoElement;

/**
 * Slide background
 */
export interface SlideBackground {
  type: 'solid' | 'image' | 'gradient';
  color?: string;
  image?: { src: string; size: 'cover' | 'contain' | 'repeat' };
  gradient?: { type: string; colors: Array<{ pos: number; color: string }>; rotate: number };
}

/**
 * Slide theme
 */
export interface SlideTheme {
  backgroundColor: string;
  fontColor: string;
  fontName: string;
}

/**
 * Canvas content structure
 */
export interface SlideCanvas {
  elements: PPTElement[];
  background?: SlideBackground;
  theme?: SlideTheme;
  viewportSize?: number;
  viewportRatio?: number;
}

/**
 * Spotlight target
 */
export interface SpotlightTarget {
  elementId: string;
  radius?: number;
}

/**
 * Laser pointer target
 */
export interface LaserTarget {
  elementId: string;
  color?: string;
  duration?: number;
}