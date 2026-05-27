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
 * Chart element
 */
export interface PPTChartElement extends PPTBaseElement {
  type: 'chart';
  chartType: string;
  data: any;
  themeColors?: string[];
}

/**
 * LaTeX element
 */
export interface PPTLatexElement extends PPTBaseElement {
  type: 'latex';
  latex: string;
  color?: string;
}

/**
 * Table element
 */
export interface PPTTableElement extends PPTBaseElement {
  type: 'table';
  data: Array<Array<{ id: string; colspan: number; rowspan: number; text: string }>>;
  colWidths?: number[];
  outline?: { width: number; style: string; color: string };
  theme?: { color: string; rowHeader: boolean; rowFooter?: boolean; colHeader?: boolean; colFooter?: boolean };
}

/**
 * Code element
 */
export interface PPTCodeElement extends PPTBaseElement {
  type: 'code';
  language?: string;
  lines: Array<{ id: string; content: string }>;
  fileName?: string;
  showLineNumbers?: boolean;
  fontSize?: number;
}

/**
 * All element types union
 */
export type PPTElement =
  | PPTTextElement
  | PPTImageElement
  | PPTShapeElement
  | PPTLineElement
  | PPTVideoElement
  | PPTChartElement
  | PPTLatexElement
  | PPTTableElement
  | PPTCodeElement;

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
 * Spotlight target options
 */
export interface SpotlightOptions {
  dimness?: number; // 0-1, default 0.7
}

/**
 * Spotlight target
 */
export interface SpotlightTarget {
  elementId: string;
  options?: SpotlightOptions;
}

/**
 * Laser pointer target options
 */
export interface LaserOptions {
  color?: string; // default '#ff3b30'
  duration?: number; // fly-in duration in ms, default 500
}

/**
 * Laser pointer target
 */
export interface LaserTarget {
  elementId: string;
  options?: LaserOptions;
}