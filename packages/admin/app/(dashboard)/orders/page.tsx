'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface Order {
  id: string;
  user_email?: string;
  user_name?: string;
  amount: number;
  token_amount: number;
  payment_method: string;
  status: string;
  order_type: string;
  subscription_plan?: string;
  transaction_id?: string;
  paid_at?: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: '待支付', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-600' },
  refunded: { label: '已退款', color: 'bg-red-100 text-red-700' },
};

const TYPE_MAP: Record<string, string> = {
  token: 'Token包',
  subscription: '订阅',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [page, filterStatus, filterType]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('order_type', filterType);

      const res = await fetch(`${API_BASE}/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="created">待支付</option>
            <option value="paid">已支付</option>
            <option value="cancelled">已取消</option>
          </select>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部类型</option>
            <option value="token">Token包</option>
            <option value="subscription">订阅</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">订单ID</th>
                <th className="px-4 py-3 text-left font-medium">用户</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">金额</th>
                <th className="px-4 py-3 text-left font-medium">Token</th>
                <th className="px-4 py-3 text-left font-medium">支付方式</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无订单</td></tr>
              ) : orders.map(order => {
                const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3">{order.user_name || order.user_email || '-'}</td>
                    <td className="px-4 py-3">{TYPE_MAP[order.order_type] || order.order_type}</td>
                    <td className="px-4 py-3 font-medium">¥{(order.amount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">{order.token_amount}</td>
                    <td className="px-4 py-3">{order.payment_method === 'wechat' ? '微信' : order.payment_method === 'alipay' ? '支付宝' : order.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}（共 {total} 条）</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
