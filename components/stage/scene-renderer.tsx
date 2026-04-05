'use client';

import { useMemo } from 'react';
import type { Scene, StageMode } from '@/lib/types/stage';
import { SlideEditor as SlideRenderer } from '../slide-renderer/Editor';
import { InteractiveRenderer } from '../scene-renderers/interactive-renderer';
import { ReportRenderer } from '../scene-renderers/report-renderer';

interface SceneRendererProps {
  readonly scene: Scene;
  readonly mode: StageMode;
}

export function SceneRenderer({ scene, mode }: SceneRendererProps) {
  const renderer = useMemo(() => {
    switch (scene.type) {
      case 'slide':
        if (scene.content.type !== 'slide') return <div>Invalid slide content</div>;
        return <SlideRenderer mode={mode} />;
      case 'interactive':
        if (scene.content.type !== 'interactive') return <div>Invalid interactive content</div>;
        return <InteractiveRenderer content={scene.content} mode={mode} sceneId={scene.id} />;
      case 'report':
        if (scene.content.type !== 'report') return <div>Invalid report content</div>;
        return <ReportRenderer content={scene.content} mode={mode} sceneId={scene.id} />;
      default:
        return <div>Unknown scene type</div>;
    }
  }, [scene, mode]);

  return <div className="w-full h-full">{renderer}</div>;
}