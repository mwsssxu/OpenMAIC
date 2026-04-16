import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Text, Group } from '@shopify/react-native-skia';

interface WhiteboardProps {
  width?: number;
  height?: number;
  elements?: any[];
}

export function Whiteboard({ width, height, elements = [] }: WhiteboardProps) {
  const screenWidth = width || Dimensions.get('window').width - 40;
  const screenHeight = height || screenWidth * 0.75;

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight }]}>
      <Canvas style={{ width: screenWidth, height: screenHeight }}>
        {/* 白板背景 */}
        <Path
          path="M 0 0 L ${screenWidth} 0 L ${screenWidth} ${screenHeight} L 0 ${screenHeight} Z"
          color="#ffffff"
        />

        {/* 绘制元素 */}
        <Group>
          {elements.map((el) => {
            if (el.type === 'text') {
              return (
                <Text
                  key={el.id}
                  x={el.x || 50}
                  y={el.y || 50}
                  text={el.content || ''}
                  fontSize={el.fontSize || 18}
                  color={el.color || '#333333'}
                />
              );
            }
            return null;
          })}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});