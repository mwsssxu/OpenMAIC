'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

interface Answer {
  id: string;
  content: string;
  author: { nickname: string; email: string };
  question_id: string;
  question_title: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AnswersReviewPage() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchAnswers();
  }, [search, filter]);

  async function fetchAnswers() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(`${apiUrl}/admin/content/answers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAnswers(data.answers || []);
      } else {
        setAnswers(getMockAnswers());
      }
    } catch {
      setAnswers(getMockAnswers());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockAnswers(): Answer[] {
    return [
      { id: '1', content: '梯度下降通过计算损失函数的梯度来确定参数更新方向...', author: { nickname: '导师A', email: 'mentor@example.com' }, question_id: 'q1', question_title: '如何理解梯度下降？', status: 'pending', created_at: '2026-04-17 11:00' },
      { id: '2', content: 'async/await让异步代码看起来像同步代码，提高可读性...', author: { nickname: '导师B', email: 'mentor2@example.com' }, question_id: 'q2', question_title: 'Python异步编程疑问', status: 'approved', created_at: '2026-04-16 15:30' },
    ];
  }

  async function handleApprove(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/answers/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      fetchAnswers();
    } catch {
      setAnswers(answers.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    }
  }

  async function handleReject(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/answers/${id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      fetchAnswers();
    } catch {
      setAnswers(answers.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    }
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">回答审核</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索回答内容"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">回答内容</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">回答者</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">关联问题</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {answers.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
                    <div className="text-sm text-gray-900 truncate max-w-xs">{a.content}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{a.author.nickname}</td>
                <td className="px-6 py-4 text-sm text-gray-500 truncate">{a.question_title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[a.status]}`}>
                    {statusLabels[a.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{a.created_at}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="查看详情">
                      <Eye className="w-4 h-4" />
                    </button>
                    {a.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(a.id)} className="p-1 text-green-400 hover:text-green-600 rounded" title="通过">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(a.id)} className="p-1 text-red-400 hover:text-red-600 rounded" title="拒绝">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <div className="text-center py-8 text-gray-500">加载中...</div>}
        {!isLoading && answers.length === 0 && <div className="text-center py-8 text-gray-500">暂无数据</div>}
      </div>
    </div>
  );
}