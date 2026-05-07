'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OutlineItem {
  id: string;
  title: string;
  type: string;
  description: string;
  order: number;
}

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  priority: number;
  enabled: boolean;
}

export default function CreateClassroomPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [outlines, setOutlines] = useState<OutlineItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingAgents, setGeneratingAgents] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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

  async function handleGenerateOutline() {
    if (!topic.trim()) {
      setError('请输入课程主题');
      return;
    }

    setError('');
    setGenerating(true);
    setOutlines([]);
    setAgents([]);

    try {
      const data = await apiClient.generateOutlines({
        requirement: topic,
        language: 'zh-CN',
      });
      setOutlines(data.outlines);

      // 自动生成 Agent
      await generateAgents(data.outlines);
    } catch (err: any) {
      setError(err.response?.data?.detail || '大纲生成失败');
    } finally {
      setGenerating(false);
    }
  }

  async function generateAgents(outlinesData: OutlineItem[]) {
    setGeneratingAgents(true);
    try {
      const data = await apiClient.generateAgentProfiles({
        stage_name: topic,
        stage_description: description,
        scene_outlines: outlinesData,
        language: 'zh-CN',
      });
      setAgents(data.agents);
    } catch (err: any) {
      // Agent 生成失败不影响流程，使用默认配置
      console.warn('Agent生成失败，使用默认配置:', err);
      try {
        const defaultData = await apiClient.getDefaultAgents('zh-CN');
        setAgents(defaultData.agents);
      } catch {
        // 完全失败也继续，后端会提供默认 agent
      }
    } finally {
      setGeneratingAgents(false);
    }
  }

  async function handleCreateClassroom() {
    if (outlines.length === 0) {
      setError('请先生成大纲');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 1. 创建课程记录（不生成场景）
      const classroom = await apiClient.createFullClassroom({
        name: topic,
        description: description,
        outlines: outlines,
        agent_ids: agents.map(a => a.id),
        agent_configs: agents,
        language: 'zh-CN',
      });

      // 2. 逐个创建场景
      for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        await apiClient.createScene(classroom.id, {
          outline: outline,
          order_index: i + 1,
          language: 'zh-CN',
        });
      }

      router.push(`/classrooms/${classroom.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '课程创建失败');
    } finally {
      setLoading(false);
    }
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      teacher: '👨‍🏫 老师',
      assistant: '👨‍💼 助教',
      student: '👨‍🎓 学生',
    };
    return labels[role] || role;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-xl">
              🎯
            </div>
            <span className="text-xl font-bold">侧伴</span>
          </Link>
          <Link href="/classrooms" className="bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1">
            <span>📚</span> 返回列表
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 页面标题 */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            ✍️
          </div>
          <h1 className="text-2xl font-bold text-gray-800">创建新课程</h1>
          <p className="text-gray-500 mt-2">AI助您快速生成专业的交互式课程</p>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-4 flex items-center gap-2 animate-scale-in">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Step 1: Topic Input */}
        <div className="card p-6 mb-6 animate-slide-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-xl text-white shadow">
              1
            </div>
            <h2 className="font-bold text-lg text-gray-800">输入课程主题</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic" className="text-gray-700 font-medium flex items-center gap-1">
                <span>🎯</span> 课程主题
              </Label>
              <Input
                id="topic"
                placeholder="例如：SWOT分析、市场定位策略、Porter五力模型..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="input-field mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-gray-700 font-medium flex items-center gap-1">
                <span>📝</span> 课程描述（可选）
              </Label>
              <Input
                id="description"
                placeholder="详细描述课程目标和学习内容..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field mt-2"
              />
            </div>
            <Button
              onClick={handleGenerateOutline}
              disabled={generating || !topic.trim()}
              className="btn-primary w-full py-3"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="loading-spinner"></span> AI正在思考...
                </span>
              ) : '🚀 生成大纲和智能体'}
            </Button>
          </div>
        </div>

        {/* Step 2: Outline Preview */}
        {outlines.length > 0 && (
          <div className="card p-6 mb-6 animate-bounce-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-xl text-white shadow">
                2
              </div>
              <h2 className="font-bold text-lg text-gray-800">大纲预览</h2>
              <span className="text-sm text-gray-500">({outlines.length} 个场景)</span>
            </div>

            {/* 大纲列表 */}
            <div className="space-y-3">
              {outlines.map((outline, index) => (
                <div
                  key={outline.id}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold shadow group-hover:scale-110 transition-transform">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{outline.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge badge-primary text-xs">
                        {outline.type === 'slide' ? '📊 幻灯片' :
                         outline.type === 'quiz' ? '❓ 测验' :
                         outline.type === 'interactive' ? '🎮 互动' : '📋 项目式学习'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Agent Preview */}
        {agents.length > 0 && (
          <div className="card p-6 mb-6 animate-bounce-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-xl text-white shadow">
                3
              </div>
              <h2 className="font-bold text-lg text-gray-800">智能体配置</h2>
              <span className="text-sm text-gray-500">({agents.length} 位角色)</span>
              {generatingAgents && (
                <span className="text-xs text-accent animate-pulse">正在生成...</span>
              )}
            </div>

            {/* Agent 列表 */}
            <div className="grid grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 hover:shadow-md transition-all"
                  style={{ borderColor: agent.color }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white"
                      style={{ backgroundColor: agent.color }}
                    >
                      {agent.avatar === 'teacher.png' ? '👨‍🏫' :
                       agent.avatar === 'assistant.png' ? '👨‍💼' :
                       agent.avatar === 'student1.png' ? '👨' :
                       agent.avatar === 'student2.png' ? '👩' : '🧑'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{agent.name}</div>
                      <div className="text-xs text-gray-500">{getRoleLabel(agent.role)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 line-clamp-2">{agent.persona}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {outlines.length > 0 && (
          <div className="card p-6 mb-6">
            <div className="flex gap-3">
              <Button
                onClick={handleCreateClassroom}
                disabled={loading}
                className="btn-secondary flex-1 py-3"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="loading-spinner"></span> 创建中...
                  </span>
                ) : '✅ 确认创建'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOutlines([]);
                  setAgents([]);
                }}
                className="hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200"
              >
                🔄 重新生成
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 border border-yellow-200 rounded-2xl p-6 animate-slide-in">
          <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2">
            <span className="text-xl">💡</span> 使用技巧
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <div className="badge badge-warning">Token</div>
              <p>课程生成消耗10-50 Token</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="badge badge-primary">AI</div>
              <p>大纲生成约需5-10秒</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="badge badge-success">推荐</div>
              <p>商业策略主题效果最佳</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="badge badge-primary">支持</div>
              <p>市场分析、竞争格局等</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}