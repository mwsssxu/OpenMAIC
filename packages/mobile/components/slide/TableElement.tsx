import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTTableElement, SlideTheme } from './types';
import { isSmallScreen } from '@/lib/utils/scaling';

interface TableElementProps {
  element: PPTTableElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

export function TableElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: TableElementProps) {
  const effectiveScale = Math.min(scaleX, scaleY);
  const data = element.data ?? [];
  const rows = data.length;
  const cols = rows > 0 ? data[0].length : 0;
  if (rows === 0 || cols === 0) return null;

  const borderColor = element.outline?.color ?? '#d0d0d0';
  const borderWidth = element.outline?.width ?? 1;
  const headerBg = element.theme?.color ?? '#5b9bd5';
  const showRowHeader = element.theme?.rowHeader ?? false;

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
      width: Math.max(element.width * scaleX, 60),
      zIndex: 1,
    };
  }, [element, scaleX, scaleY, isWhiteboard]);

  const fontSize = Math.max(isSmallScreen ? 8 : 10, Math.round(12 * effectiveScale));

  return (
    <View style={containerStyle}>
      <View style={{ borderWidth, borderColor, borderRadius: 4, overflow: 'hidden' }}>
        {data.map((row, ri) => {
          const isHeader = ri === 0 && showRowHeader;
          return (
            <View key={ri} style={{ flexDirection: 'row' as const }}>
              {row.map((cell, ci) => {
                const isFirstCol = ci === 0 && showRowHeader;
                const bg = isHeader ? headerBg : isFirstCol ? '#f0f4f8' : '#ffffff';
                const textColor = isHeader ? '#ffffff' : '#333333';
                return (
                  <View
                    key={cell.id || `${ri}-${ci}`}
                    style={{
                      flex: 1,
                      backgroundColor: bg,
                      borderRightWidth: ci < cols - 1 ? borderWidth : 0,
                      borderBottomWidth: ri < rows - 1 ? borderWidth : 0,
                      borderColor,
                      paddingHorizontal: 6 * effectiveScale,
                      paddingVertical: 4 * effectiveScale,
                      minHeight: 28 * effectiveScale,
                      justifyContent: 'center' as const,
                    }}
                  >
                    <Text
                      style={{
                        fontSize,
                        color: textColor,
                        fontWeight: isHeader || isFirstCol ? '600' as const : '400' as const,
                      }}
                      numberOfLines={2}
                    >
                      {cell.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
