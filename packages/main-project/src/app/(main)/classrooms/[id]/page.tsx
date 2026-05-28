'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useCollaboration, useWhiteboardSync } from '@/lib/websocket';
import { Whiteboard, ChatPanel, ParticipantsList } from '@/components/collaboration';
import { WebPlaybackEngine, PlaybackMode, Scene } from '@/lib/playback/engine';
import { SpotlightOverlay, LaserOverlay } from '@/components/playback';

interface Agent {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  priority: number;
  enabled: boolean;
}

interface ClassroomData {
  stage: {
    id: string;
    name: string;
    description?: string;
    agent_ids?: string[];
    style?: any;
  };
  scenes: Scene[];
  agents?: Agent[];
}

export default function ClassroomPlayPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);

  // Playback states
  const playbackEngineRef = useRef<WebPlaybackEngine | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('idle');
  const [spotlightElementId, setSpotlightElementId] = useState<string | null>(null);
  const [laserElementId, setLaserElementId] = useState<string | null>(null);
  const [laserColor, setLaserColor] = useState('#ff3b30');

  // Canvas dimensions for precise layout
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const VIEWPORT_WIDTH = 1000;
  const VIEWPORT_HEIGHT = 562.5;

  // Calculate scale based on actual container size
  const getCanvasScale = useCallback(() => {
    if (canvasDimensions.width === 0) return { scaleX: 1, scaleY: 1 };
    const scaleX = canvasDimensions.width / VIEWPORT_WIDTH;
    const scaleY = canvasDimensions.height / VIEWPORT_HEIGHT;
    return { scaleX, scaleY };
  }, [canvasDimensions]);

  // Monitor canvas container size changes
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial update
    updateDimensions();

    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const id = params.id as string;

  const { client, isConnected: wsConnected } = useCollaboration(id, token || '');
  const { sync, isConnected: crdtConnected } = useWhiteboardSync(id, token || '');

  // Initialize playback engine
  const initPlaybackEngine = useCallback(() => {
    if (!data?.scenes) return;

    playbackEngineRef.current = new WebPlaybackEngine(data.scenes as Scene[], {
      onSceneChange: (index, _scene) => {
        setCurrentSceneIndex(index);
        setSpotlightElementId(null);
        setLaserElementId(null);
      },
      onModeChange: (mode) => {
        setPlaybackMode(mode);
      },
      onComplete: () => {
        console.log('[Playback] All scenes completed');
      },
      onError: (error) => {
        console.error('[Playback]', error);
      },
      onSpotlight: (elementId, _dimness) => {
        setSpotlightElementId(elementId);
        setLaserElementId(null);
      },
      onLaser: (elementId, color) => {
        setLaserElementId(elementId);
        setLaserColor(color || '#ff3b30');
      },
      onClearEffects: () => {
        setSpotlightElementId(null);
        setLaserElementId(null);
      },
      onSpeechStart: (text) => {
        console.log('[Speech]', text.slice(0, 50));
      },
      onSpeechEnd: () => {
        console.log('[Speech] Complete');
      },
    });
  }, [data]);

  useEffect(() => {
    if (data && !loading) {
      initPlaybackEngine();
    }
  }, [data, loading, initPlaybackEngine]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadClassroom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, id]);

  async function loadClassroom() {
    setLoading(true);
    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);

      // 获取 agent 配置
      await loadAgents(classroomData);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载课程失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents(classroomData: ClassroomData) {
    try {
      // 尝试获取已配置的 agent
      if (classroomData.stage.agent_ids && classroomData.stage.agent_ids.length > 0) {
        const agentsData = await apiClient.generateAgentProfiles({
          stage_name: classroomData.stage.name,
          stage_description: classroomData.stage.description,
          language: 'zh-CN',
        });
        setAgents(agentsData.agents);
        setSelectedAgentId(agentsData.agents[0]?.id || '');
      } else {
        // 使用默认 agent
        const defaultAgents = await apiClient.getDefaultAgents('zh-CN');
        setAgents(defaultAgents.agents);
        setSelectedAgentId(defaultAgents.agents[0]?.id || '');
      }
    } catch (err) {
      console.warn('Agent加载失败，使用默认:', err);
      // 降级到默认 agent
      try {
        const defaultAgents = await apiClient.getDefaultAgents('zh-CN');
        setAgents(defaultAgents.agents);
        setSelectedAgentId(defaultAgents.agents[0]?.id || '');
      } catch {
        // 完全失败，设置空的 agent 列表，聊天功能将不可用
        setAgents([]);
        setSelectedAgentId('');
      }
    }
  }

  function goToNextScene() {
    playbackEngineRef.current?.nextScene();
  }

  function goToPrevScene() {
    playbackEngineRef.current?.prevScene();
  }

  // Playback controls
  function handlePlay() {
    if (playbackMode === 'idle' || playbackMode === 'paused') {
      playbackEngineRef.current?.playCurrentScene();
    }
  }

  function handlePause() {
    playbackEngineRef.current?.pause();
  }

  function handleStop() {
    playbackEngineRef.current?.stop();
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      teacher: '老师',
      assistant: '助教',
      student: '学生',
    };
    return labels[role] || role;
  }

  // Helper functions for Spotlight/Laser geometry
  function getElementGeometry(elementId: string, elements: any[]): { centerX: number; centerY: number; width: number; height: number } | null {
    const element = elements.find((el: any) => el.id === elementId);
    if (!element) return null;

    const width = element.width || 100;
    const height = element.height || 50;
    const left = element.left || 50;
    const top = element.top || 50;

    return {
      centerX: left + width / 2,
      centerY: top + height / 2,
      width,
      height,
    };
  }

  function getElementPosition(elementId: string, elements: any[]): { x: number; y: number } | null {
    const element = elements.find((el: any) => el.id === elementId);
    if (!element) return null;

    const width = element.width || 100;
    const height = element.height || 50;
    const left = element.left || 50;
    const top = element.top || 50;

    return {
      x: left + width / 2,
      y: top + height / 2,
    };
  }

  // Calculate content height from elements
  function calculateContentHeight(elements: any[]): number {
    if (!elements || elements.length === 0) return VIEWPORT_HEIGHT;

    let maxBottom = 0;
    elements.forEach((el: any) => {
      const top = el.top || 0;
      const height = el.height || 50;
      maxBottom = Math.max(maxBottom, top + height);
    });

    // Add padding at the bottom
    return Math.max(VIEWPORT_HEIGHT, maxBottom + 40);
  }

  // Cleanup playback engine on unmount
  useEffect(() => {
    return () => {
      playbackEngineRef.current?.dispose();
    };
  }, []);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white rounded-2xl p-8 shadow-xl text-center animate-bounce-in">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Button className="btn-primary" onClick={loadClassroom}>
            🔄 重试
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">加载课程内容...</div>
        </div>
      </div>
    );
  }

  const currentScene = data.scenes[currentSceneIndex];
  const progress = ((currentSceneIndex + 1) / data.scenes.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/classrooms" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">←</div>
            <span className="font-bold">返回</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <h1 className="text-lg font-bold">{data.stage.name}</h1>
              <div className="text-xs text-white/80">
                场景 {currentSceneIndex + 1} / {data.scenes.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(wsConnected || crdtConnected) && (
              <span className="badge badge-success animate-pulse">
                🟢 协作已连接
              </span>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-1 bg-white/20">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Scene Content */}
          <div className="flex-1">
            {/* Agent 选择器 */}
            {agents.length > 0 && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                <span className="text-sm text-gray-500">当前对话角色:</span>
                <div className="flex gap-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                        selectedAgentId === agent.id
                          ? 'bg-indigo-100 border-2 border-indigo-400'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                        style={{ backgroundColor: agent.color }}
                      >
                        {agent.name[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{agent.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="card relative animate-fade-in">
              {/* 场景类型标签 */}
              <div className="absolute top-4 left-4 z-10">
                <span className={`badge ${
                  currentScene?.type === 'slide' ? 'badge-primary' :
                  currentScene?.type === 'quiz' ? 'badge-warning' :
                  currentScene?.type === 'interactive' ? 'badge-success' : 'badge-primary'
                }`}>
                  {currentScene?.type === 'slide' ? '📊 幻灯片' :
                   currentScene?.type === 'quiz' ? '❓ 测验' :
                   currentScene?.type === 'interactive' ? '🎮 互动' : '📋 项目式学习'}
                </span>
              </div>

              {/* 场景内容 - 添加滚动支持 */}
              <div
                ref={canvasContainerRef}
                className="p-8 pt-14 relative overflow-auto max-h-[70vh]"
                style={{ minHeight: '300px' }}
              >
                {currentScene?.type === 'slide' && (() => {
                  const { scaleX, scaleY } = getCanvasScale();
                  const elements = currentScene.content?.canvas?.elements || [];
                  const contentHeight = calculateContentHeight(elements) * scaleY;

                  return (
                    <div
                      className="animate-slide-in relative bg-white rounded-lg shadow-sm"
                      style={{
                        minHeight: `${contentHeight}px`,
                        height: `${contentHeight}px`,
                      }}
                    >
                      {elements.map((el: any) => {
                        // 精确坐标定位
                        const style: React.CSSProperties = {
                          position: 'absolute',
                          left: el.left * scaleX,
                          top: el.top * scaleY,
                          width: el.width * scaleX,
                          minHeight: el.height * scaleY,
                        };

                        return (
                          <div key={el.id} style={style}>
                            {el.type === 'text' && (
                              <div
                                className="font-bold text-gray-800"
                                style={{
                                  fontSize: (el.style?.fontSize || el.defaultFontSize || 24) * scaleX,
                                  color: el.style?.color || el.defaultColor || '#1f2937',
                                }}
                              >
                                {/* 支持HTML content或纯文本 */}
                                {el.content?.includes('<p')
                                  ? el.content.replace(/<[^>]+>/g, '') // 提取纯文本
                                  : el.content}
                              </div>
                            )}
                            {el.type === 'shape' && (
                              <div
                                className="rounded-xl shadow"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  background: `linear-gradient(135deg, ${el.fill || el.style?.backgroundColor || '#6366f1'}, ${el.fill || el.style?.backgroundColor || '#8b5cf6'})`,
                                }}
                              />
                            )}
                            {el.type === 'line' && (
                              <div
                                className="rounded"
                                style={{
                                  width: Math.abs((el.end?.[0] || 100) - (el.start?.[0] || 0)) * scaleX,
                                  backgroundColor: el.color || el.defaultColor || '#5b9bd5',
                                  height: (el.width || el.strokeWidth || 2) * scaleY,
                                }}
                              />
                            )}
                            {el.type === 'chart' && (
                              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 text-center w-full h-full">
                                <span className="text-3xl">📊</span>
                                <div className="mt-2 font-medium text-gray-700">{el.content || el.chartType}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {currentScene?.type === 'quiz' && (
                  <div className="animate-slide-in">
                    <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                      <span className="text-2xl">❓</span> {currentScene.title}
                    </h2>
                    <div className="space-y-4">
                      {currentScene.content?.questions?.map((q: any) => (
                        <div key={q.id} className="card p-5 hover:shadow-lg transition-shadow">
                          <p className="font-semibold mb-4 text-gray-700">{q.question}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {q.options?.map((opt: any) => (
                              <button
                                key={opt.value}
                                className="bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl p-3 text-left hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                              >
                                <span className="font-medium text-gray-600 group-hover:text-indigo-600">
                                  {opt.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentScene?.type === 'interactive' && (
                  <div className="text-center animate-bounce-in py-12">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg">
                      🎮
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">{currentScene.title}</h2>
                    <p className="text-gray-500 mt-2">互动场景（待实现）</p>
                  </div>
                )}

                {currentScene?.type === 'pbl' && (
                  <div className="text-center animate-bounce-in py-12">
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg">
                      📋
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">{currentScene.title}</h2>
                    <p className="text-gray-500 mt-2">项目式学习（待实现）</p>
                  </div>
                )}
              </div>

              {/* Whiteboard Overlay */}
              {showWhiteboard && (
                <div className="absolute inset-0 bg-white border-2 border-indigo-400 animate-fade-in">
                  <Whiteboard sync={sync} userId={user?.id || ''} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    onClick={() => setShowWhiteboard(false)}
                  >
                    ✕ 关闭白板
                  </Button>
                </div>
              )}

              {/* Spotlight/Laser Effects */}
              {(() => {
                const elements = currentScene?.content?.canvas?.elements;
                if (!elements || canvasDimensions.width === 0) return null;
                const { scaleX, scaleY } = getCanvasScale();
                const spotlightGeometry = spotlightElementId ? getElementGeometry(spotlightElementId, elements) : null;
                const laserPosition = laserElementId ? getElementPosition(laserElementId, elements) : null;
                return (
                  <>
                    {spotlightGeometry && (
                      <SpotlightOverlay
                        geometry={spotlightGeometry}
                        canvasWidth={canvasDimensions.width}
                        canvasHeight={canvasDimensions.height}
                        dimness={0.7}
                        scaleX={scaleX}
                        scaleY={scaleY}
                      />
                    )}
                    {laserPosition && (
                      <LaserOverlay
                        position={laserPosition}
                        canvasWidth={canvasDimensions.width}
                        canvasHeight={canvasDimensions.height}
                        color={laserColor}
                        scaleX={scaleX}
                        scaleY={scaleY}
                      />
                    )}
                  </>
                );
              })()}
            </div>

            {/* Controls */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={goToPrevScene}
                  disabled={currentSceneIndex === 0}
                  className="hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50"
                >
                  ← 上一页
                </Button>
                <div className="flex gap-3">
                  {/* Playback controls */}
                  <div className="flex gap-2 mr-3 border-r pr-3">
                    {playbackMode === 'idle' && (
                      <Button
                        className="bg-green-500 hover:bg-green-600 text-white"
                        onClick={handlePlay}
                      >
                        🔊 播放
                      </Button>
                    )}
                    {playbackMode === 'playing' && (
                      <Button
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                        onClick={handlePause}
                      >
                        ⏸️ 暂停
                      </Button>
                    )}
                    {playbackMode === 'paused' && (
                      <Button
                        className="bg-green-500 hover:bg-green-600 text-white"
                        onClick={handlePlay}
                      >
                        🔊 继续
                      </Button>
                    )}
                    {playbackMode !== 'idle' && (
                      <Button
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={handleStop}
                      >
                        ⏹️ 停止
                      </Button>
                    )}
                  </div>
                  <Button
                    className={`${showWhiteboard ? 'btn-primary' : 'bg-white border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'}`}
                    onClick={() => setShowWhiteboard(!showWhiteboard)}
                  >
                    📝 白板
                  </Button>
                  <Button
                    className={`${showCollaboration ? 'btn-secondary' : 'bg-white border-2 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50'}`}
                    onClick={() => setShowCollaboration(!showCollaboration)}
                  >
                    💬 协作
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={goToNextScene}
                  disabled={currentSceneIndex === data.scenes.length - 1}
                  className="hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50"
                >
                  下一页 →
                </Button>
              </div>
            </div>
          </div>

          {/* Collaboration Sidebar */}
          {showCollaboration && (
            <div className="w-80 space-y-4 animate-slide-in">
              <div className="card p-4">
                <ParticipantsList client={client} />
              </div>
              {/* Agent 信息卡片 */}
              {agents.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span>🤖</span> 课程智能体
                  </h3>
                  <div className="space-y-2">
                    {agents.map((agent) => (
                      <div
                        key={agent.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedAgentId === agent.id
                            ? 'bg-indigo-50 border border-indigo-200'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedAgentId(agent.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white"
                            style={{ backgroundColor: agent.color }}
                          >
                            {agent.avatar === 'teacher.png' ? '👨‍🏫' :
                             agent.avatar === 'assistant.png' ? '👨‍💼' : '👨'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{agent.name}</div>
                            <div className="text-xs text-gray-500">{getRoleLabel(agent.role)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="card h-64">
                <ChatPanel client={client} agentId={selectedAgentId} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}