/**
 * ImageElement - Image element renderer for Mobile
 */

import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import type { PPTImageElement } from './types';

interface ImageElementProps {
  element: PPTImageElement;
  /** Scale factor for positioning */
  scale: number;
}

/**
 * ImageElement Component
 */
export function ImageElement({ element, scale }: ImageElementProps) {
  // Container style with absolute positioning - scaled
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: element.top * scale,
    left: element.left * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: [{ rotate: `${element.rotate || 0}deg` }],
    zIndex: 1,
  }), [element, scale]);

  // Flip transforms
  const flipTransform = useMemo(() => {
    const transforms: Array<{ scaleX: number } | { scaleY: number }> = [];
    if (element.flipH) transforms.push({ scaleX: -1 });
    if (element.flipV) transforms.push({ scaleY: -1 });
    return transforms;
  }, [element]);

  // Image style
  const imageStyle = useMemo(() => ({
    width: element.width * scale,
    height: element.height * scale,
    borderRadius: (element.radius || 0) * scale,
    resizeMode: 'cover' as const,
  }), [element, scale]);

  return (
    <View style={[containerStyle, flipTransform.length > 0 && { transform: flipTransform }]}>
      <Image source={{ uri: element.src }} style={imageStyle} />
    </View>
  );
}