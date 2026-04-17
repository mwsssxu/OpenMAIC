'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { WhiteboardSync, WhiteboardElement } from '@/lib/websocket/whiteboard-sync';

interface WhiteboardProps {
  sync: WhiteboardSync | null;
  userId: string;
}

export function Whiteboard({ sync, userId }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [currentPathId, setCurrentPathId] = useState<string | null>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);

  useEffect(() => {
    if (!sync) return;

    // observe现在返回清理函数
    const cleanup = sync.observe((newElements) => {
      setElements(newElements);
    });

    setElements(sync.getElements());

    // 清理函数
    return cleanup;
  }, [sync]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    elements.forEach((element) => {
      if (element.type === 'path' && element.data.points) {
        ctx.beginPath();
        ctx.strokeStyle = element.data.color || '#000000';
        ctx.lineWidth = element.data.width || 2;
        element.data.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
      if (element.type === 'shape' && element.data.position && element.data.size) {
        ctx.fillStyle = element.data.color || '#5b9bd5';
        ctx.fillRect(
          element.data.position.x,
          element.data.position.y,
          element.data.size.width,
          element.data.size.height
        );
      }
      if (element.type === 'text' && element.data.position && element.data.content) {
        ctx.fillStyle = element.data.color || '#333333';
        ctx.font = '16px sans-serif';
        ctx.fillText(element.data.content, element.data.position.x, element.data.position.y);
      }
    });
  }, [elements]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sync) return;

    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = uuidv4();
    setCurrentPathId(id);

    const element: WhiteboardElement = {
      id,
      type: tool === 'eraser' ? 'eraser' : 'path',
      userId,
      timestamp: Date.now(),
      data: {
        color: tool === 'eraser' ? '#ffffff' : color,
        width: tool === 'eraser' ? 20 : 2,
        points: [{ x, y }],
      },
    };

    sync.addElement(element);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !sync || !currentPathId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentElement = elements.find(el => el.id === currentPathId);
    if (currentElement && currentElement.data.points) {
      sync.updateElement(currentPathId, {
        points: [...currentElement.data.points, { x, y }],
      });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setCurrentPathId(null);
  };

  const handleClear = useCallback(() => {
    if (!sync) return;
    sync.clear();
  }, [sync]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setTool('pen')}
          className={`px-3 py-1 rounded ${tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          画笔
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`px-3 py-1 rounded ${tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          橡皮
        </button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8"
          disabled={tool === 'eraser'}
        />
        <button
          onClick={handleClear}
          className="px-3 py-1 rounded bg-red-500 text-white"
        >
          清空
        </button>
        {sync?.isConnected() && (
          <span className="text-xs text-green-600">CRDT同步已连接</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-gray-300 bg-white cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}