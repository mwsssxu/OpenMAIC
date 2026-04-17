'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Question {
  id: string;
  title: string;
  content: string;
  author: { nickname: string; email: string };
  classroom_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function QuestionsReviewPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchQuestions();
  }, [search, filter]);

  async function fetchQuestions() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(`${apiUrl}/admin/content/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      } else {
        setQuestions(getMockQuestions());
      }
    } catch {
      setQuestions(getMockQuestions());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockQuestions(): Question[] {
    return [
      { id: '1', title: '如何理解梯度下降？', content: '梯度下降的核心思想是什么...', author: { nickname: '学习者1', email: 'user1@example.com' }, classroom_id: 'ml-101', status: 'pending', created_at: '2026-04-17 10:30' },
      { id: '2', title: 'Python异步编程疑问', content: 'async/await的使用场景...', author: { nickname: '学习者2', email: 'user2@example.com' }, classroom_id: 'py-201', status: 'approved', created_at: '2026-04-16 14:20' },
      { id: '3', title: '神经网络参数调优', content: '学习率和批次大小的关系...', author: { nickname: '学习者3', email: 'user3@example.com' }, classroom_id: 'dl-301', status: 'rejected', created_at: '2026-04-15 09:15' },
    ];
  }

  async function handleApprove(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/questions/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchQuestions();
    } catch {
      setQuestions(questions.map(q => q.id === id ? { ...q, status: 'approved' } : q));
    }
  }

  async function handleReject(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/questions/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchQuestions();
    } catch {
      setQuestions(questions.map(q => q.id === id ? { ...q, status: 'rejected' } : q));
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
        <h1 className="text-2xl font-bold text-gray-900">问题审核</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索问题标题"
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">问题</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">提问者</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">课程</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{q.title}</div>
                  <div className="text-sm text-gray-500 truncate max-w-xs">{q.content}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{q.author.nickname}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{q.classroom_id}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[q.status]}`}>
                    {statusLabels[q.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{q.created_at}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="查看详情">
                      <Eye className="w-4 h-4" />
                    </button>
                    {q.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(q.id)}
                          className="p-1 text-green-400 hover:text-green-600 rounded"
                          title="通过"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(q.id)}
                          className="p-1 text-red-400 hover:text-red-600 rounded"
                          title="拒绝"
                        >
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
        {!isLoading && questions.length === 0 && <div className="text-center py-8 text-gray-500">暂无数据</div>}
      </div>
    </div>
  );
}