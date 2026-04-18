import React from 'react';
import { View, StyleSheet, Dimensions, Text as RNText } from 'react-native';

interface WhiteboardProps {
  width?: number;
  height?: number;
  elements?: any[];
}

export function WhiteboardInteractive({ width, height, elements = [] }: WhiteboardProps) {
  const screenWidth = width || Dimensions.get('window').width - 40;
  const screenHeight = height || screenWidth * 0.75;

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight }]}>
      {/* 白板背景 */}
      <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#ffffff' }} />

      {/* 绘制元素 */}
      {elements.map((el) => {
        if (el.type === 'text') {
          return (
            <RNText
              key={el.id}
              style={{
                position: 'absolute',
                left: el.x || 50,
                top: el.y || 50,
                fontSize: el.fontSize || 18,
                color: el.color || '#333333',
              }}
            >
              {el.content || ''}
            </RNText>
          );
        }
        return null;
      })}
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