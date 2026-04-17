'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function CreateQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bounty, setBounty] = useState(0);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pointBalance, setPointBalance] = useState(0);

  useEffect(() => {
    loadBalance();
  }, []);

  async function loadBalance() {
    try {
      const data = await apiClient.getPointBalance();
      setPointBalance(data.balance || 0);
    } catch (error) {
      console.error('Load balance error:', error);
    }
  }

  async function submitQuestion() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.createQuestion({
        title,
        content,
        bounty,
        tags,
      });
      router.push('/questions');
    } catch (error: any) {
      alert(error.response?.data?.detail || '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">发布问题</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder="问题标题"
              maxLength={255}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-48 border rounded-lg p-3 resize-none"
              placeholder="详细描述你的问题..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              悬赏积分（当前余额：{pointBalance} 积分）
            </label>
            <input
              type="number"
              value={bounty}
              onChange={(e) => setBounty(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg p-3"
              placeholder="设置悬赏积分（可选）"
              min={0}
              max={Math.min(pointBalance, 10000)}
            />
            <p className="text-sm text-gray-500 mt-1">
              最小 10 积分，最大 10000 积分
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">标签</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder="标签（逗号分隔）"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              onClick={submitQuestion}
              disabled={submitting || !title.trim() || !content.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {submitting ? '发布中...' : '发布问题'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}