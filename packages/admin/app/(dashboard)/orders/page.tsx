'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';

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

interface OrderDetail extends Order {
  user_id: string;
  subscription_days?: number;
  updated_at?: string;
  callbacks?: {
    id: string;
    provider: string;
    transaction_id: string;
    amount: number;
    status: string;
    processed: boolean;
    created_at: string;
  }[];
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
  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('用户申请退款');
  const [refunding, setRefunding] = useState(false);

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

      const res = await fetch(`${API_BASE}/admin/orders?${params}`, {
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

  async function fetchOrderDetail(orderId: string) {
    setDetailLoading(true);
    setDetailOrder(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailOrder(data);
      }
    } catch (e) {
      console.error('Failed to fetch order detail:', e);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitRefund() {
    if (!detailOrder) return;
    setRefunding(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({ reason: refundReason });
      const res = await fetch(
        `${API_BASE}/admin/orders/${detailOrder.id}/refund?${params}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setRefundModal(false);
        setDetailOrder(null);
        fetchOrders();
        alert(`退款成功\n扣回 Token: ${data.refunded_tokens}\n订阅取消: ${data.subscription_cancelled ? '是' : '否'}`);
      } else {
        const err = await res.text();
        alert(`退款失败 (${res.status}): ${err.slice(0, 200)}`);
      }
    } catch (e) {
      alert('网络错误，请稍后重试');
    } finally {
      setRefunding(false);
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
            <option value="refunded">已退款</option>
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
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => fetchOrderDetail(order.id)}
                  >
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

      {/* 订单详情弹窗 */}
      {detailOrder !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => !detailLoading && setDetailOrder(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-12 text-center text-gray-400">加载中...</div>
            ) : detailOrder ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">订单详情</h2>
                  <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="订单 ID" value={detailOrder.id} mono />
                  <DetailItem label="状态" value={
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[detailOrder.status] || { color: 'bg-gray-100' }).color}`}>
                      {(STATUS_MAP[detailOrder.status] || { label: detailOrder.status }).label}
                    </span>
                  } />
                  <DetailItem label="用户" value={detailOrder.user_name || detailOrder.user_email || detailOrder.user_id?.slice(0, 8) + '...'} />
                  <DetailItem label="类型" value={TYPE_MAP[detailOrder.order_type] || detailOrder.order_type} />
                  <DetailItem label="金额" value={`¥${(detailOrder.amount / 100).toFixed(2)}`} />
                  <DetailItem label="Token" value={String(detailOrder.token_amount || 0)} />
                  <DetailItem label="支付方式" value={detailOrder.payment_method === 'wechat' ? '微信支付' : detailOrder.payment_method === 'alipay' ? '支付宝' : detailOrder.payment_method} />
                  <DetailItem label="交易号" value={detailOrder.transaction_id || '-'} mono />
                  <DetailItem label="创建时间" value={new Date(detailOrder.created_at).toLocaleString('zh-CN')} />
                  <DetailItem label="支付时间" value={detailOrder.paid_at ? new Date(detailOrder.paid_at).toLocaleString('zh-CN') : '-'} />
                  {detailOrder.subscription_plan && (
                    <DetailItem label="订阅方案" value={`${detailOrder.subscription_plan} (${detailOrder.subscription_days || 30}天)`} />
                  )}
                </div>

                {/* 支付回调记录 */}
                {detailOrder.callbacks && detailOrder.callbacks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">支付回调记录</h3>
                    <div className="space-y-2">
                      {detailOrder.callbacks.map(cb => (
                        <div key={cb.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                          <span className="font-mono text-gray-600">{cb.provider} · {cb.transaction_id?.slice(0, 20) || '-'}</span>
                          <span className={`px-2 py-0.5 rounded-full ${cb.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {cb.status}
                          </span>
                          <span className="text-gray-400">{new Date(cb.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 退款按钮 */}
                {detailOrder.status === 'paid' && (
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={() => { setRefundModal(true); setRefundReason('用户申请退款'); }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      退款
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 退款确认弹窗 */}
      {refundModal && detailOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
          onClick={() => !refunding && setRefundModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认退款</h3>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                订单 <span className="font-mono text-gray-900">{detailOrder.id.slice(0, 8)}...</span>
                · 金额 <span className="font-bold text-gray-900">¥{(detailOrder.amount / 100).toFixed(2)}</span>
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                <p>退款将执行以下操作：</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {detailOrder.token_amount > 0 && <li>扣回 {detailOrder.token_amount} Token（余额不足时扣到 0）</li>}
                  {detailOrder.order_type === 'subscription' && <li>取消订阅，立即失效</li>}
                  <li>订单状态改为「已退款」</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退款原因</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={refunding}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRefundModal(false)}
                disabled={refunding}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={submitRefund}
                disabled={refunding || !refundReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {refunding ? '退款中...' : '确认退款'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
