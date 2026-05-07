/**
 * Layout Detection Tests
 */

import { detectLayoutMode, getElementPosition } from './layout-detection';
import type { PPTElement } from '../types';

// Helper to create minimal element for testing
function createTestElement(props: Record<string, unknown>): PPTElement {
  return {
    id: props.id as string || 'test',
    type: 'text',
    defaultFontName: 'System',
    defaultColor: '#333',
    left: props.left as number || 0,
    top: props.top as number || 0,
    width: props.width as number || 100,
    height: props.height as number || 50,
    rotate: 0,
    ...props,
  } as PPTElement;
}

describe('detectLayoutMode', () => {
  it('should return "empty" for empty array', () => {
    expect(detectLayoutMode([])).toBe('empty');
  });

  it('should return "simplified" for position object format', () => {
    const elements = [
      createTestElement({
        id: 'title-1',
        position: { left: 0, top: 0, width: 900, height: 60 },
        content: 'Test',
        left: undefined,
        top: undefined,
      }),
    ];
    expect(detectLayoutMode(elements)).toBe('simplified');
  });

  it('should return "precise" for direct left/top format', () => {
    const elements = [
      createTestElement({
        id: 'text-1',
        left: 100,
        top: 50,
        width: 200,
        height: 30,
        content: 'Test',
      }),
    ];
    expect(detectLayoutMode(elements)).toBe('precise');
  });

  it('should default to "simplified" when neither format detected', () => {
    const elements = [
      createTestElement({
        id: 'unknown',
        content: 'Test',
        left: undefined,
        top: undefined,
      }),
    ];
    expect(detectLayoutMode(elements)).toBe('simplified');
  });
});

describe('getElementPosition', () => {
  it('should extract from position object', () => {
    const element = {
      position: { left: 50, top: 100, width: 900, height: 50 },
    };
    const pos = getElementPosition(element);
    expect(pos).toEqual({ left: 50, top: 100, width: 900, height: 50 });
  });

  it('should extract from direct properties', () => {
    const element = {
      left: 200,
      top: 150,
      width: 500,
      height: 80,
    };
    const pos = getElementPosition(element);
    expect(pos).toEqual({ left: 200, top: 150, width: 500, height: 80 });
  });

  it('should use defaults for missing values', () => {
    const element = {};
    const pos = getElementPosition(element);
    // Default for direct properties: width=100, height=50
    expect(pos).toEqual({ left: 0, top: 0, width: 100, height: 50 });
  });

  it('should use position defaults when position object incomplete', () => {
    const element = {
      position: { left: 50 },
    };
    const pos = getElementPosition(element);
    expect(pos.left).toBe(50);
    expect(pos.top).toBe(0);
    expect(pos.width).toBe(900);
    expect(pos.height).toBe(50);
  });
});