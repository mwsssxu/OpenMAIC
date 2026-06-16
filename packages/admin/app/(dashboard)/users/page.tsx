'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Ban, Gift, X, ShieldOff, ShieldCheck } from 'lucide-react';

interface User {
  id: string;
  email: string;
  nickname: string;
  token_balance: number;
  point_balance: number;
  subscription_tier: string;
  created_at: string;
  is_active: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  // 操作弹框
  const [actionModal, setActionModal] = useState<{ type: 'detail' | 'ban' | 'unban' | 'gift-tokens' | 'gift-points'; user: User } | null>(null);
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftType, setGiftType] = useState<'tokens' | 'points'>('tokens');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, [search, filter]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('tier', filter);

      const response = await fetch(`${API_BASE}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setError('加载失败');
      }
    } catch {
      setError('加载失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function doAction() {
    if (!actionModal) return;
    setActionLoading(true);
    const token = localStorage.getItem('admin_token');
    try {
      let url = '';
      let method = 'POST';
      let body: any = {};

      switch (actionModal.type) {
        case 'ban':
          url = `${API_BASE}/api/admin/users/${actionModal.user.id}/ban`;
          break;
        case 'unban':
          url = `${API_BASE}/api/admin/users/${actionModal.user.id}/unban`;
          break;
        case 'gift-tokens':
          url = `${API_BASE}/api/admin/users/${actionModal.user.id}/gift-tokens`;
          body = { amount: giftAmount };
          break;
        case 'gift-points':
          url = `${API_BASE}/api/admin/users/${actionModal.user.id}/gift-points`;
          body = { amount: giftAmount };
          break;
        case 'detail':
          // 详情只展示，不操作
          setActionLoading(false);
          return;
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setActionModal(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.detail || '操作失败');
      }
    } catch {
      alert('操作失败');
    } finally {
      setActionLoading(false);
    }
  }

  const tierLabel = (t: string) => t === 'premium' ? 'Pro' : t === 'enterprise' ? '企业' : '免费';
  const tierColor = (t: string) => t === 'enterprise' ? 'bg-purple-100 text-purple-700' : t === 'premium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索邮箱/昵称"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64"
            />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">全部用户</option>
            <option value="free">免费用户</option>
            <option value="premium">Pro会员</option>
            <option value="enterprise">企业会员</option>
          </select>
        </div>
      </div>

      {/* 桌面端：表格 */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">用户</th>
              <th className="px-4 py-3 text-left font-medium">Token</th>
              <th className="px-4 py-3 text-left font-medium">积分</th>
              <th className="px-4 py-3 text-left font-medium">会员</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-medium">
                      {user.nickname?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.nickname || '-'}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{user.token_balance}</td>
                <td className="px-4 py-3">{user.point_balance}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${tierColor(user.subscription_tier)}`}>{tierLabel(user.subscription_tier)}</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? '正常' : '禁用'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setActionModal({ type: 'detail', user })} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="查看详情">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => setActionModal({ type: user.is_active ? 'ban' : 'unban', user })} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title={user.is_active ? '禁用用户' : '启用用户'}>
                      {user.is_active ? <Ban className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setGiftType('tokens'); setGiftAmount(10); setActionModal({ type: 'gift-tokens', user }); }} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="赠送Token">
                      <Gift className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端：卡片列表 */}
      <div className="lg:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : users.map(user => (
          <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
                  {user.nickname?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{user.nickname || '-'}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.is_active ? '正常' : '禁用'}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-gray-600 mb-3">
              <span>Token: {user.token_balance}</span>
              <span>积分: {user.point_balance}</span>
              <span className={`px-1.5 py-0.5 rounded-full ${tierColor(user.subscription_tier)}`}>{tierLabel(user.subscription_tier)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActionModal({ type: 'detail', user })} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">详情</button>
              <button onClick={() => setActionModal({ type: user.is_active ? 'ban' : 'unban', user })} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${user.is_active ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {user.is_active ? '禁用' : '启用'}
              </button>
              <button onClick={() => { setGiftType('tokens'); setGiftAmount(10); setActionModal({ type: 'gift-tokens', user }); }} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">赠送</button>
            </div>
          </div>
        ))}
      </div>

      {/* 操作弹框 */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {actionModal.type === 'detail' ? '用户详情' :
                   actionModal.type === 'ban' ? '禁用用户' :
                   actionModal.type === 'unban' ? '启用用户' :
                   '赠送资源'}
                </h2>
                <button onClick={() => setActionModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm font-medium text-gray-900">{actionModal.user.nickname || actionModal.user.email}</div>
                <div className="text-xs text-gray-500 mt-1">{actionModal.user.email} | ID: {actionModal.user.id.slice(0, 8)}</div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span>Token: {actionModal.user.token_balance}</span>
                  <span>积分: {actionModal.user.point_balance}</span>
                  <span>{tierLabel(actionModal.user.subscription_tier)}</span>
                </div>
              </div>

              {actionModal.type === 'detail' ? (
                <div className="text-sm text-gray-600">
                  <p>注册时间: {new Date(actionModal.user.created_at).toLocaleString('zh-CN')}</p>
                  <p>状态: {actionModal.user.is_active ? '正常' : '已禁用'}</p>
                  <p className="mt-4 text-gray-400 text-xs">完整用户详情请访问 /admin/users/{actionModal.user.id}</p>
                </div>
              ) : actionModal.type === 'ban' ? (
                <div>
                  <p className="text-sm text-red-600 mb-4">禁用后该用户将无法登录和使用平台功能。</p>
                </div>
              ) : actionModal.type === 'unban' ? (
                <div>
                  <p className="text-sm text-green-600 mb-4">启用后该用户可正常登录和使用平台。</p>
                </div>
              ) : (actionModal.type === 'gift-tokens' || actionModal.type === 'gift-points') ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setGiftType('tokens')} className={`px-4 py-2 rounded-lg text-sm ${giftType === 'tokens' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Token</button>
                    <button onClick={() => setGiftType('points')} className={`px-4 py-2 rounded-lg text-sm ${giftType === 'points' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>积分</button>
                  </div>
                  <input
                    type="number"
                    value={giftAmount}
                    onChange={e => setGiftAmount(Number(e.target.value))}
                    min={1}
                    max={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="赠送数量"
                  />
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setActionModal(null)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">取消</button>
                {actionModal.type !== 'detail' && (
                  <button
                    onClick={doAction}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
                  >
                    {actionLoading ? '处理中...' : '确认'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
