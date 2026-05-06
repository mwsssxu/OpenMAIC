/**
 * ImageElement - Image element renderer for Mobile
 */

import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import type { PPTImageElement } from './types';

interface ImageElementProps {
  element: PPTImageElement;
  /** Scale factor for horizontal positioning */
  scaleX: number;
  /** Scale factor for vertical positioning */
  scaleY: number;
}

/**
 * ImageElement Component
 */
export function ImageElement({ element, scaleX, scaleY }: ImageElementProps) {
  // Container style with absolute positioning - dual-axis scaled
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scaleY,
    left: element.left * scaleX,
    width: element.width * scaleX,
    height: element.height * scaleY,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [element, scaleX, scaleY]);

  // Flip transforms
  const flipTransform = useMemo(() => {
    const transforms: Array<{ scaleX: number } | { scaleY: number }> = [];
    if (element.flipH) transforms.push({ scaleX: -1 });
    if (element.flipV) transforms.push({ scaleY: -1 });
    return transforms;
  }, [element]);

  // Image style
  const imageStyle = useMemo(() => ({
    width: element.width * scaleX,
    height: element.height * scaleY,
    borderRadius: (element.radius || 0) * Math.min(scaleX, scaleY),
    resizeMode: 'cover' as const,
  }), [element, scaleX, scaleY]);

  return (
    <View style={[containerStyle, flipTransform.length > 0 && { transform: flipTransform }]}>
      <Image source={{ uri: element.src }} style={imageStyle} />
    </View>
  );
}