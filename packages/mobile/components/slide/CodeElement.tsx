import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { PPTCodeElement, SlideTheme } from './types';
import { isSmallScreen } from '@/lib/utils/scaling';

interface CodeElementProps {
  element: PPTCodeElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

export function CodeElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: CodeElementProps) {
  const effectiveScale = Math.min(scaleX, scaleY);
  const lines = element.lines ?? [];
  const showLineNumbers = element.showLineNumbers ?? true;
  const baseFontSize = Math.max(isSmallScreen ? 8 : 10, Math.round((element.fontSize ?? 14) * effectiveScale));

  const containerStyle = useMemo(() => {
    if (isWhiteboard) {
      return {
        width: '100%' as const,
        marginBottom: 8,
        zIndex: 1,
      };
    }
    return {
      position: 'absolute' as const,
      left: element.left * scaleX,
      top: element.top * scaleY,
      width: Math.max(element.width * scaleX, 80),
      height: element.height > 0 ? element.height * scaleY : undefined,
      zIndex: 1,
    };
  }, [element, scaleX, scaleY, isWhiteboard]);

  return (
    <View style={containerStyle}>
      <View style={styles.codeBlock}>
        {/* macOS-style header */}
        <View style={styles.codeHeader}>
          <View style={styles.headerDots}>
            <View style={[styles.dot, { backgroundColor: '#ff5f57' }]} />
            <View style={[styles.dot, { backgroundColor: '#febc2e' }]} />
            <View style={[styles.dot, { backgroundColor: '#28c840' }]} />
          </View>
          <Text style={[styles.codeLang, { fontSize: Math.max(8, Math.round(10 * effectiveScale)) }]}>
            {element.language ?? 'code'}
          </Text>
          {element.fileName && (
            <Text style={[styles.fileName, { fontSize: Math.max(8, Math.round(10 * effectiveScale)) }]}>
              {element.fileName}
            </Text>
          )}
        </View>
        {/* Code body */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ padding: 8 * effectiveScale }}>
            {lines.map((line, i) => (
              <View key={line.id || `L${i}`} style={{ flexDirection: 'row' as const }}>
                {showLineNumbers && (
                  <Text style={{
                    fontSize: baseFontSize,
                    fontFamily: 'Menlo' as const,
                    color: '#aaa',
                    width: Math.max(20, 30 * effectiveScale),
                    textAlign: 'right' as const,
                    marginRight: Math.max(4, 8 * effectiveScale),
                    lineHeight: baseFontSize * 1.5,
                  }}>
                    {i + 1}
                  </Text>
                )}
                <Text style={{
                  fontSize: baseFontSize,
                  fontFamily: 'Menlo' as const,
                  color: '#333',
                  lineHeight: baseFontSize * 1.5,
                }} selectable>
                  {line.content}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = {
  codeBlock: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden' as const,
  },
  codeHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerDots: {
    flexDirection: 'row' as const,
    gap: 4,
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  codeLang: {
    color: '#666',
    fontWeight: '500' as const,
  },
  fileName: {
    color: '#999',
    marginLeft: 8,
  },
};