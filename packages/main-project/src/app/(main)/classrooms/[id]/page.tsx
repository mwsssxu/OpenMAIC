'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface Scene {
  id: string;
  type: string;
  title: string;
  order_index: number;
  content: any;
  actions: any[];
}

interface ClassroomData {
  stage: {
    id: string;
    name: string;
    description?: string;
  };
  scenes: Scene[];
}

export default function ClassroomPlayPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadClassroom();
    }
  }, [isAuthenticated, id]);

  async function loadClassroom() {
    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载课程失败');
    } finally {
      setLoading(false);
    }
  }

  function goToNextScene() {
    if (data && currentSceneIndex < data.scenes.length - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
    }
  }

  function goToPrevScene() {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-error/10 text-error rounded-md p-4">
          {error}
          <Button onClick={loadClassroom} className="mt-2">
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  const currentScene = data.scenes[currentSceneIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white shadow">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/classrooms" className="text-lg font-bold hover:underline">
            ← 返回
          </Link>
          <h1 className="text-lg">{data.stage.name}</h1>
          <div className="text-sm">
            {currentSceneIndex + 1} / {data.scenes.length}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Scene Content */}
        <div className="bg-white rounded-card shadow aspect-video max-w-4xl mx-auto relative overflow-hidden">
          {currentScene?.type === 'slide' && (
            <div className="p-8">
              {/* Render slide elements */}
              {currentScene.content?.canvas?.elements?.map((el: any) => (
                <div
                  key={el.id}
                  className="mb-4"
                >
                  {el.type === 'text' && (
                    <div
                      className="font-medium"
                      style={{
                        fontSize: el.style?.fontSize || 18,
                        color: el.style?.color || '#333',
                      }}
                    >
                      {el.content}
                    </div>
                  )}
                  {el.type === 'shape' && (
                    <div
                      className="w-32 h-8 rounded"
                      style={{
                        backgroundColor: el.style?.backgroundColor || '#5b9bd5',
                      }}
                    />
                  )}
                  {el.type === 'chart' && (
                    <div className="bg-gray-100 rounded p-4 text-center">
                      📊 {el.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentScene?.type === 'quiz' && (
            <div className="p-8">
              <h2 className="text-xl font-bold mb-4">{currentScene.title}</h2>
              <div className="space-y-4">
                {currentScene.content?.questions?.map((q: any) => (
                  <div key={q.id} className="border rounded-md p-4">
                    <p className="font-medium mb-3">{q.question}</p>
                    <div className="space-y-2">
                      {q.options?.map((opt: any) => (
                        <button
                          key={opt.value}
                          className="w-full text-left p-2 border rounded hover:bg-gray-50"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentScene?.type === 'interactive' && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">🎮</div>
              <h2 className="text-xl font-bold">{currentScene.title}</h2>
              <p className="text-gray-500 mt-2">互动场景（待实现）</p>
            </div>
          )}

          {currentScene?.type === 'pbl' && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h2 className="text-xl font-bold">{currentScene.title}</h2>
              <p className="text-gray-500 mt-2">项目式学习（待实现）</p>
            </div>
          )}

          {/* Whiteboard Overlay */}
          {showWhiteboard && (
            <div className="absolute inset-0 bg-white/95 border-2 border-primary">
              <div className="p-4">
                <div className="text-sm text-gray-500 mb-2">白板绘制区</div>
                <div className="border rounded h-64 bg-gray-50">
                  {/* Whiteboard canvas placeholder */}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowWhiteboard(false)}
                >
                  关闭白板
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="max-w-4xl mx-auto mt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goToPrevScene}
              disabled={currentSceneIndex === 0}
            >
              ← 上一页
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowWhiteboard(!showWhiteboard)}
              >
                📝 白板
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={goToNextScene}
              disabled={currentSceneIndex === data.scenes.length - 1}
            >
              下一页 →
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-primary rounded-full transition-all"
                style={{
                  width: `${((currentSceneIndex + 1) / data.scenes.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}