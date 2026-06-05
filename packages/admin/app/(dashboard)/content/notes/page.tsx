'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, FileText } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  author: { nickname: string; email: string };
  classroom_id: string;
  status: 'pending' | 'approved' | 'rejected';
  likes: number;
  created_at: string;
}

export default function NotesReviewPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchNotes();
  }, [search, filter]);

  async function fetchNotes() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(`${apiUrl}/admin/content/notes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      } else {
        setError('加载失败，请稍后重试');
      }
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/notes/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      fetchNotes();
    } catch {
      setError('操作失败，请稍后重试');
    }
  }

  async function handleReject(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');
      await fetch(`${apiUrl}/admin/content/notes/${id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      fetchNotes();
    } catch {
      setError('操作失败，请稍后重试');
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
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">笔记审核</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索笔记标题"
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">笔记</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作者</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">课程</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点赞</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {notes.map((n) => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-400 mt-1" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{n.content}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{n.author.nickname}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{n.classroom_id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{n.likes}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[n.status]}`}>
                    {statusLabels[n.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{n.created_at}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="查看详情">
                      <Eye className="w-4 h-4" />
                    </button>
                    {n.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(n.id)} className="p-1 text-green-400 hover:text-green-600 rounded" title="通过">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(n.id)} className="p-1 text-red-400 hover:text-red-600 rounded" title="拒绝">
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
        {!isLoading && notes.length === 0 && <div className="text-center py-8 text-gray-500">暂无数据</div>}
      </div>
    </div>
  );
}