'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, Clock, User, Activity } from 'lucide-react';

interface LogEntry {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target: string;
  details: string;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [search, filter]);

  async function fetchLogs() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('action', filter);

      const response = await fetch(`${apiUrl}/admin/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        setLogs(getMockLogs());
      }
    } catch {
      setLogs(getMockLogs());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockLogs(): LogEntry[] {
    return [
      { id: '1', admin_id: 'admin1', admin_name: '管理员A', action: 'user_ban', target: 'user@example.com', details: '禁用用户账号', created_at: '2026-04-17 10:30:00' },
      { id: '2', admin_id: 'admin1', admin_name: '管理员A', action: 'content_approve', target: 'question#123', details: '审核通过问题', created_at: '2026-04-17 10:25:00' },
      { id: '3', admin_id: 'admin2', admin_name: '管理员B', action: 'settings_update', target: 'llm_config', details: '更新LLM配置', created_at: '2026-04-17 09:15:00' },
      { id: '4', admin_id: 'admin2', admin_name: '管理员B', action: 'pricing_update', target: 'token_pack', details: '修改Token包价格', created_at: '2026-04-16 14:00:00' },
      { id: '5', admin_id: 'admin1', admin_name: '管理员A', action: 'content_reject', target: 'note#456', details: '审核拒绝笔记', created_at: '2026-04-16 11:30:00' },
    ];
  }

  const actionLabels: Record<string, string> = {
    user_ban: '禁用用户',
    user_unban: '启用用户',
    content_approve: '审核通过',
    content_reject: '审核拒绝',
    settings_update: '更新设置',
    pricing_update: '更新定价',
    gift_tokens: '赠送Token',
    gift_points: '赠送积分',
  };

  const actionColors: Record<string, string> = {
    user_ban: 'bg-red-100 text-red-700',
    user_unban: 'bg-green-100 text-green-700',
    content_approve: 'bg-green-100 text-green-700',
    content_reject: 'bg-yellow-100 text-yellow-700',
    settings_update: 'bg-blue-100 text-blue-700',
    pricing_update: 'bg-purple-100 text-purple-700',
    gift_tokens: 'bg-orange-100 text-orange-700',
    gift_points: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">操作日志</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索日志"
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
            <option value="all">全部操作</option>
            <option value="user_ban">用户管理</option>
            <option value="content_approve">内容审核</option>
            <option value="settings_update">系统配置</option>
            <option value="pricing_update">价格配置</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">管理员</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">{log.created_at}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
                      {log.admin_name.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-900">{log.admin_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                    {actionLabels[log.action] || log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{log.target}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <div className="text-center py-8 text-gray-500">加载中...</div>}
        {!isLoading && logs.length === 0 && <div className="text-center py-8 text-gray-500">暂无日志</div>}
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          共 {logs.length} 条日志
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg">
            上一页
          </button>
          <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg">
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}