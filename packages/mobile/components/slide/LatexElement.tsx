import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTLatexElement, SlideTheme } from './types';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface LatexElementProps {
  element: PPTLatexElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
}

export function LatexElement({ element, theme, scaleX, scaleY }: LatexElementProps) {
  const effectiveScale = Math.min(scaleX, scaleY);

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : undefined,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  const fontSize = sFont(16 * effectiveScale, isSmallScreen ? 10 : 12);

  return (
    <View style={containerStyle}>
      <View style={styles.formulaBox}>
        <Text style={[styles.formulaText, { fontSize, color: element.color ?? '#333' }]} selectable>
          {element.latex}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  formulaBox: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    justifyContent: 'center' as const,
  },
  formulaText: {
    fontFamily: 'Menlo' as const,
    letterSpacing: 0.5,
  },
};
