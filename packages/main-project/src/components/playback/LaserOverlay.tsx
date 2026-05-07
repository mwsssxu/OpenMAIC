/**
 * LaserOverlay - Web端激光笔效果
 *
 * 使用CSS动画实现飞入和脉冲效果
 */

import { useMemo, useEffect, useState } from 'react';

interface LaserOverlayProps {
  /** Target position (viewport coordinates) */
  position: {
    x: number;
    y: number;
  };
  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;
  /** Laser color */
  color?: string;
  /** Animation duration (ms) */
  duration?: number;
  /** Scale factors */
  scaleX: number;
  scaleY: number;
  /** Padding offset from parent container */
  paddingTop?: number;
}

export function LaserOverlay({
  position,
  canvasWidth,
  canvasHeight,
  color = '#ff3b30',
  duration = 500,
  scaleX,
  scaleY,
  paddingTop = 56, // pt-14 = 56px
}: LaserOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  // Calculate scaled position with padding offset
  const scaledX = useMemo(() => position.x * scaleX, [position, scaleX]);
  const scaledY = useMemo(() => position.y * scaleY - paddingTop, [position, scaleY, paddingTop]);

  // Determine start position (fly-in from opposite corner)
  const startPos = useMemo(() => {
    const viewportWidth = canvasWidth / scaleX;
    const viewportHeight = canvasHeight / scaleY + paddingTop;
    const isRightSide = position.x > viewportWidth / 2;
    const isBottomSide = position.y > viewportHeight / 2;

    return {
      x: isRightSide ? -20 : canvasWidth + 20,
      y: isBottomSide ? -20 : canvasHeight + 20,
    };
  }, [position, canvasWidth, canvasHeight, scaleX, scaleY, paddingTop]);

  // Trigger fly-in animation
  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight, zIndex: 20, top: 32, left: 32 }} // p-8 offset
    >
      {/* Pulsing ring */}
      {isVisible && (
        <div
          className="absolute animate-pulse-ring"
          style={{
            left: isAnimating ? startPos.x : scaledX - 15,
            top: isAnimating ? startPos.y : scaledY - 15,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            backgroundColor: 'transparent',
            transform: isAnimating ? 'scale(1)' : undefined,
            transition: isAnimating ? `left ${duration}ms ease-out, top ${duration}ms ease-out` : undefined,
          }}
        />
      )}

      {/* Core dot */}
      {isVisible && (
        <div
          className="absolute animate-glow"
          style={{
            left: isAnimating ? startPos.x : scaledX - 5,
            top: isAnimating ? startPos.y : scaledY - 5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            transition: isAnimating ? `left ${duration}ms ease-out, top ${duration}ms ease-out` : undefined,
          }}
        />
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }

        @keyframes glow {
          0%, 100% {
            boxShadow: 0 0 4px ${color};
          }
          50% {
            boxShadow: 0 0 12px ${color};
          }
        }

        .animate-pulse-ring {
          animation: pulse-ring 1.2s ease-out infinite;
        }

        .animate-glow {
          animation: glow 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}