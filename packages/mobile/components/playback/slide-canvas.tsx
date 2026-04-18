import React from 'react';
import { View, StyleSheet, Dimensions, Text as RNText, Image as RNImage } from 'react-native';

interface SlideElement {
  id: string;
  type: string;
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
  const height = screenWidth * 0.5625;

  const renderElement = (el: SlideElement) => {
    const left = el.position?.left || 0;
    const top = el.position?.top || 0;
    const w = el.position?.width || 200;
    const h = el.position?.height || 50;

    switch (el.type) {
      case 'text':
        return (
          <RNText
            key={el.id}
            style={{
              position: 'absolute',
              left: left,
              top: top,
              fontSize: el.style?.fontSize || 18,
              color: el.style?.color || '#333333',
            }}
          >
            {el.content || ''}
          </RNText>
        );

      case 'shape':
        return (
          <View
            key={el.id}
            style={{
              position: 'absolute',
              left: left,
              top: top,
              width: w,
              height: h,
              backgroundColor: el.style?.backgroundColor || '#5b9bd5',
            }}
          />
        );

      case 'image':
        return (
          <RNImage
            key={el.id}
            source={{ uri: el.content }}
            style={{
              position: 'absolute',
              left: left,
              top: top,
              width: w,
              height: h,
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.canvas, { width: screenWidth, height: height }]}>
      {elements.map(renderElement)}
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