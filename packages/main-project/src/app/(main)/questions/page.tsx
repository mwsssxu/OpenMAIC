'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Question {
  id: string;
  title: string;
  bounty: number;
  bounty_status: string;
  view_count: number;
  answer_count: number;
  has_accepted: boolean;
  user_nickname: string;
  created_at: string;
}

export default function QuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    loadQuestions();
  }, [sort]);

  async function loadQuestions() {
    setLoading(true);
    try {
      const data = await apiClient.getQuestions({ sort, limit: 20 });
      setQuestions(data.items || []);
    } catch (err) {
      console.error('Load questions error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">问答悬赏</h1>
          <button
            onClick={() => router.push('/questions/create')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            发布问题
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSort('recent')}
            className={`px-3 py-1 rounded ${sort === 'recent' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            最新
          </button>
          <button
            onClick={() => setSort('bounty')}
            className={`px-3 py-1 rounded ${sort === 'bounty' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            最高悬赏
          </button>
          <button
            onClick={() => setSort('hot')}
            className={`px-3 py-1 rounded ${sort === 'hot' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            最热门
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">加载中...</div>
        ) : questions.length === 0 ? (
          <div className="text-center py-10 text-gray-500">暂无问题</div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-lg font-medium text-gray-800">{q.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {q.user_nickname} · {new Date(q.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {q.bounty > 0 && (
                      <div className="text-orange-500 font-medium">
                        悬赏 {q.bounty} 积分
                      </div>
                    )}
                    {q.has_accepted && (
                      <div className="text-green-500 text-sm mt-1">已解决</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-sm text-gray-400">
                  <span>👁 {q.view_count} 浏览</span>
                  <span>💬 {q.answer_count} 回答</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}