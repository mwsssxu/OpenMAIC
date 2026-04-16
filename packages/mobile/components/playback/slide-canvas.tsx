import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Rect, Text, Image, Group } from '@shopify/react-native-skia';

interface SlideElement {
  id: string;
  type: string; // text, shape, image, chart, latex, table
  content?: string;
  position?: { left: number; top: number; width?: number; height?: number };
  style?: { fontSize?: number; color?: string; backgroundColor?: string };
}

interface SlideCanvasProps {
  elements: SlideElement[];
  width?: number;
}

export function SlideCanvas({ elements, width }: SlideCanvasProps) {
  const screenWidth = width || Dimensions.get('window').width - 20;
  const height = screenWidth * 0.5625; // 16:9 比例

  // 简化渲染：仅支持 text 和 shape
  const renderElement = (el: SlideElement) => {
    const left = el.position?.left || 0;
    const top = el.position?.top || 0;
    const w = el.position?.width || 200;
    const h = el.position?.height || 50;

    switch (el.type) {
      case 'text':
        return (
          <Text
            key={el.id}
            x={left}
            y={top + (el.style?.fontSize || 18)}
            text={el.content || ''}
            fontSize={el.style?.fontSize || 18}
            color={el.style?.color || '#333333'}
          />
        );

      case 'shape':
        return (
          <Rect
            key={el.id}
            x={left}
            y={top}
            width={w}
            height={h}
            color={el.style?.backgroundColor || '#5b9bd5'}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.canvas, { width: screenWidth, height: height }]}>
      <Canvas style={{ width: screenWidth, height: height }}>
        <Group>
          {elements.map(renderElement)}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});