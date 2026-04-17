'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, MoreHorizontal, Eye, Ban, Gift } from 'lucide-react';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string;
  token_balance: number;
  point_balance: number;
  subscription_tier: string;
  created_at: string;
  is_active: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, [search, filter]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('tier', filter);

      const response = await fetch(`${apiUrl}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        // 模拟数据
        setUsers([
          { id: '1', email: 'user1@example.com', nickname: '学习者1', avatar_url: '', token_balance: 200, point_balance: 500, subscription_tier: 'premium', created_at: '2026-01-15', is_active: true },
          { id: '2', email: 'user2@example.com', nickname: '学习者2', avatar_url: '', token_balance: 50, point_balance: 100, subscription_tier: 'free', created_at: '2026-02-20', is_active: true },
          { id: '3', email: 'user3@example.com', nickname: '学习者3', avatar_url: '', token_balance: 500, point_balance: 1000, subscription_tier: 'enterprise', created_at: '2026-03-10', is_active: false },
        ]);
      }
    } catch (error) {
      setUsers([
        { id: '1', email: 'user1@example.com', nickname: '学习者1', avatar_url: '', token_balance: 200, point_balance: 500, subscription_tier: 'premium', created_at: '2026-01-15', is_active: true },
        { id: '2', email: 'user2@example.com', nickname: '学习者2', avatar_url: '', token_balance: 50, point_balance: 100, subscription_tier: 'free', created_at: '2026-02-20', is_active: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索邮箱/昵称"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">全部用户</option>
            <option value="free">免费用户</option>
            <option value="premium">高级会员</option>
            <option value="enterprise">企业会员</option>
          </select>
        </div>
      </div>

      {/* 用户表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">积分</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">会员</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
                      {user.nickname?.charAt(0) || 'U'}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.nickname}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.token_balance}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.point_balance}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.subscription_tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                    user.subscription_tier === 'premium' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {user.subscription_tier}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.created_at}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.is_active ? '正常' : '禁用'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <Ban className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <Gift className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        )}

        {!isLoading && users.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无数据</div>
        )}
      </div>
    </div>
  );
}