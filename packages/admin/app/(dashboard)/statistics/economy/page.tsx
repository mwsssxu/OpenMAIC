'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Coins, Gift, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface EconomyStats {
  revenue_today: number;
  revenue_month: number;
  tokens_purchased: number;
  points_earned: number;
  points_spent: number;
  revenue_trend: { date: string; revenue: number; tokens: number }[];
  top_transactions: { user: string; type: string; amount: number; time: string }[];
}

export default function EconomyStatsPage() {
  const [stats, setStats] = useState<EconomyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/statistics/economy`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('加载失败，请稍后重试');
      }
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}
      <h1 className="text-2xl font-bold text-gray-900">经济统计</h1>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="今日收入" value={`¥${((stats?.revenue_today || 0) / 100).toFixed(2)}`} icon={<DollarSign />} change={+22} />
        <StatCard title="本月收入" value={`¥${((stats?.revenue_month || 0) / 100).toFixed(2)}`} icon={<DollarSign />} change={+15} />
        <StatCard title="Token购买" value={stats?.tokens_purchased || 0} icon={<Coins />} change={+8} />
        <StatCard title="积分产生" value={stats?.points_earned || 0} icon={<Gift />} change={+12} />
      </div>

      {/* 积分流动 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">积分产生</h2>
          <div className="text-3xl font-bold text-green-600">{stats?.points_earned}</div>
          <div className="text-sm text-gray-500 mt-2">今日新增积分</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">积分消费</h2>
          <div className="text-3xl font-bold text-orange-600">{stats?.points_spent}</div>
          <div className="text-sm text-gray-500 mt-2">今日消费积分</div>
        </div>
      </div>

      {/* 收入趋势 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">收入趋势 (近7天)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats?.revenue_trend}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => value >= 1000 ? `¥${(value/100).toFixed(2)}` : value} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="收入(元)" strokeWidth={2} />
            <Line type="monotone" dataKey="tokens" stroke="#10b981" name="Token购买" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 最近交易 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近交易</h2>
        <div className="space-y-3">
          {stats?.top_transactions?.map((tx, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
                  {tx.user.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{tx.user}</div>
                  <div className="text-xs text-gray-500">{tx.type}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {tx.type.includes('积分') ? tx.amount : `¥${tx.amount}`}
                </div>
                <div className="text-xs text-gray-500">{tx.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  change,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">{icon}</div>
          <div>
            <div className="text-sm text-gray-500">{title}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span className="text-sm">{change}%</span>
        </div>
      </div>
    </div>
  );
}