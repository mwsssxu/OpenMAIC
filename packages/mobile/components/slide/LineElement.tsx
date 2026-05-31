/**
 * LineElement - Line element renderer for Mobile
 *
 * Uses react-native-svg to render lines (aligned with web implementation)
 * Handles start point offset correctly
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, Marker, Circle, Polygon } from 'react-native-svg';
import type { PPTLineElement } from './types';

interface LineElementProps {
  element: PPTLineElement;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

/**
 * Generate line path string (aligned with web getLineElementPath)
 */
function getLineElementPath(element: PPTLineElement): string {
  const startArr = Array.isArray(element.start) ? element.start : [0, 0];
  const endArr = Array.isArray(element.end) ? element.end : [100, 100];
  const start = startArr.join(',');
  const end = endArr.join(',');

  // Handle different line types
  if ((element as any).broken) {
    const mid = (element as any).broken.join(',');
    return `M${start} L${mid} L${end}`;
  } else if ((element as any).broken2) {
    const minX = Math.min(startArr[0], endArr[0]);
    const maxX = Math.max(startArr[0], endArr[0]);
    const minY = Math.min(startArr[1], endArr[1]);
    const maxY = Math.max(startArr[1], endArr[1]);
    if (maxX - minX >= maxY - minY) {
      return `M${start} L${(element as any).broken2[0]},${startArr[1]} L${(element as any).broken2[0]},${endArr[1]} ${end}`;
    }
    return `M${start} L${startArr[0]},${(element as any).broken2[1]} L${endArr[0]},${(element as any).broken2[1]} ${end}`;
  } else if ((element as any).curve) {
    const mid = (element as any).curve.join(',');
    return `M${start} Q${mid} ${end}`;
  } else if ((element as any).cubic) {
    const [c1, c2] = (element as any).cubic;
    const p1 = c1.join(',');
    const p2 = c2.join(',');
    return `M${start} C${p1} ${p2} ${end}`;
  }

  return `M${start} L${end}`;
}

export function LineElement({ element, scaleX, scaleY, isWhiteboard = false }: LineElementProps) {
  const startX = element.start[0];
  const startY = element.start[1];
  const endX = element.end[0];
  const endY = element.end[1];

  // Calculate SVG dimensions to contain both points (with minimum size)
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const rawWidth = Math.abs(endX - startX);
  const rawHeight = Math.abs(endY - startY);

  // Ensure minimum dimensions for visibility
  const svgWidth = Math.max(rawWidth, 24);
  const svgHeight = Math.max(rawHeight, 24);

  // Line width (element.width from PPTBaseElement)
  const lineWidth = element.width || 2;
  const avgScale = (scaleX + scaleY) / 2;

  // Dash array based on style
  const lineDashArray = useMemo(() => {
    if (element.style === 'dashed') {
      return lineWidth <= 8 ? `${lineWidth * 5} ${lineWidth * 2.5}` : `${lineWidth * 5} ${lineWidth * 1.5}`;
    }
    if (element.style === 'dotted') {
      return lineWidth <= 8 ? `${lineWidth * 1.8} ${lineWidth * 1.6}` : `${lineWidth * 1.5} ${lineWidth * 1.2}`;
    }
    return undefined;
  }, [element.style, lineWidth]);

  // Generate path
  const path = useMemo(() => getLineElementPath(element), [element]);

  // Container position (add minX/minY to position so the SVG container starts from the min point)
  const containerLeft = (element.left + minX) * scaleX;
  const containerTop = (element.top + minY) * scaleY;

  // Adjust path coordinates to be relative to SVG viewBox (offset by minX, minY)
  const adjustedPath = useMemo(() => {
    return path.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_, x, y) => {
      const adjX = parseFloat(x) - minX;
      const adjY = parseFloat(y) - minY;
      return `${adjX},${adjY}`;
    });
  }, [path, minX, minY]);

  // Point markers (arrow heads, dots, etc.)
  const hasStartPoint = element.points?.[0] && element.points[0] !== '';
  const hasEndPoint = element.points?.[1] && element.points[1] !== '';

  const markerDefs = useMemo(() => {
    if (!hasStartPoint && !hasEndPoint) return null;

    const markers: React.ReactNode[] = [];

    if (hasStartPoint) {
      const pointType = element.points[0];
      if (pointType === 'dot') {
        markers.push(
          <Marker
            key="start"
            id="start-marker"
            markerWidth={10}
            markerHeight={10}
            refX={5}
            refY={5}
            orient="auto"
          >
            <Circle cx={5} cy={5} r={3} fill={element.color} />
          </Marker>
        );
      } else if (pointType === 'arrow') {
        markers.push(
          <Marker
            key="start"
            id="start-marker"
            markerWidth={10}
            markerHeight={10}
            refX={0}
            refY={5}
            orient="auto"
          >
            <Polygon points="10,0 0,5 10,10" fill={element.color} />
          </Marker>
        );
      }
    }

    if (hasEndPoint) {
      const pointType = element.points[1];
      if (pointType === 'dot') {
        markers.push(
          <Marker
            key="end"
            id="end-marker"
            markerWidth={10}
            markerHeight={10}
            refX={5}
            refY={5}
            orient="auto"
          >
            <Circle cx={5} cy={5} r={3} fill={element.color} />
          </Marker>
        );
      } else if (pointType === 'arrow') {
        markers.push(
          <Marker
            key="end"
            id="end-marker"
            markerWidth={10}
            markerHeight={10}
            refX={10}
            refY={5}
            orient="auto"
          >
            <Polygon points="0,0 10,5 0,10" fill={element.color} />
          </Marker>
        );
      }
    }

    return <Defs>{markers}</Defs>;
  }, [element, hasStartPoint, hasEndPoint]);

  if (isWhiteboard) {
    return (
      <View style={{ width: '100%', minHeight: svgHeight * avgScale + 20, marginBottom: 8, zIndex: 1 }}>
        <View style={{ position: 'absolute', left: (element.left + minX) * scaleX, top: (element.top + minY) * scaleY, zIndex: 1 }}>
          <Svg width={svgWidth * avgScale} height={svgHeight * avgScale} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {markerDefs}
            <Path
              d={adjustedPath}
              stroke={element.color}
              strokeWidth={lineWidth}
              strokeDasharray={lineDashArray}
              fill="none"
              markerStart={hasStartPoint ? 'url(#start-marker)' : undefined}
              markerEnd={hasEndPoint ? 'url(#end-marker)' : undefined}
            />
          </Svg>
        </View>
      </View>
    );
  }

  // Non-whiteboard: absolute positioning
  return (
    <View style={{
      position: 'absolute' as const,
      left: containerLeft,
      top: containerTop,
      zIndex: 1,
    }}>
      <Svg width={svgWidth * avgScale} height={svgHeight * avgScale} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {markerDefs}
        <Path
          d={adjustedPath}
          stroke={element.color}
          strokeWidth={lineWidth}
          strokeDasharray={lineDashArray}
          fill="none"
          markerStart={hasStartPoint ? 'url(#start-marker)' : undefined}
          markerEnd={hasEndPoint ? 'url(#end-marker)' : undefined}
        />
      </Svg>
    </View>
  );
}
