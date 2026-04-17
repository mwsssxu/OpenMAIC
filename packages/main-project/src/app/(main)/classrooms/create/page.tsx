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

export default function CreateClassroomPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [outlines, setOutlines] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
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

    try {
      const data = await apiClient.generateOutlines({
        requirement: topic,
        language: 'zh-CN',
      });
      setOutlines(data.outlines);
    } catch (err: any) {
      setError(err.response?.data?.detail || '大纲生成失败');
    } finally {
      setGenerating(false);
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
      // 创建课程
      const classroom = await apiClient.createClassroom({
        name: topic,
        description: description,
        language_directive: 'zh-CN',
      });

      // 生成场景
      await apiClient.generateScenes({
        outlines: outlines,
        language: 'zh-CN',
      });

      router.push(`/classrooms/${classroom.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '课程创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:underline">
            OpenMAIC Business
          </Link>
          <Link href="/classrooms" className="text-sm hover:underline">
            返回列表
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">创建课程</h1>

        {error && (
          <div className="bg-error/10 text-error rounded-md p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Topic Input */}
        <div className="bg-white rounded-card shadow p-6 mb-6">
          <h2 className="font-semibold mb-4">Step 1: 输入课程主题</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic">课程主题</Label>
              <Input
                id="topic"
                placeholder="例如：SWOT分析、市场定位策略、Porter五力模型..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">课程描述（可选）</Label>
              <Input
                id="description"
                placeholder="详细描述课程目标和学习内容..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              onClick={handleGenerateOutline}
              disabled={generating || !topic.trim()}
            >
              {generating ? '生成中...' : '生成大纲'}
            </Button>
          </div>
        </div>

        {/* Step 2: Outline Preview */}
        {outlines.length > 0 && (
          <div className="bg-white rounded-card shadow p-6 mb-6 animate-fade-in">
            <h2 className="font-semibold mb-4">Step 2: 大纲预览</h2>
            <div className="space-y-2">
              {outlines.map((outline, index) => (
                <div
                  key={outline.id}
                  className="border rounded-md p-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{outline.title}</div>
                    <div className="text-sm text-gray-500">
                      {outline.type === 'slide' ? '幻灯片' :
                       outline.type === 'quiz' ? '测验' :
                       outline.type === 'interactive' ? '互动' : '项目式学习'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleCreateClassroom}
                disabled={loading}
              >
                {loading ? '创建中...' : '确认创建'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOutlines([])}
              >
                重新生成
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-accent-gold/10 rounded-card p-4">
          <h3 className="font-semibold text-accent-gold mb-2">💡 提示</h3>
          <div className="text-sm text-gray-600">
            <p>• 课程生成会消耗10-50 Token</p>
            <p>• 大纲生成约需5-10秒</p>
            <p>• 场景生成约需30-60秒</p>
            <p>• 支持商业策略主题：市场分析、竞争格局、财务评估等</p>
          </div>
        </div>
      </main>
    </div>
  );
}