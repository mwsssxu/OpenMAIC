'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, Activity, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface UserStats {
  total: number;
  new_today: number;
  active_today: number;
  tier_distribution: { tier: string; count: number }[];
  growth: { date: string; new_users: number; active_users: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function UserStatsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
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

      const response = await fetch(`${apiUrl}/admin/statistics/users`, {
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
      <h1 className="text-2xl font-bold text-gray-900">用户统计</h1>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-sm text-gray-500">总用户数</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.total}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm text-gray-500">今日新增</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.new_today}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-sm text-gray-500">今日活跃</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.active_today}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 用户增长趋势 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">用户增长趋势 (近7天)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats?.growth}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="new_users" stroke="#3b82f6" name="新增用户" strokeWidth={2} />
            <Line type="monotone" dataKey="active_users" stroke="#10b981" name="活跃用户" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 会员分布 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">会员等级分布</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats?.tier_distribution}
                dataKey="count"
                nameKey="tier"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {stats?.tier_distribution?.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {stats?.tier_distribution?.map((item, index) => (
              <div key={item.tier} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-sm text-gray-600">{item.tier}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}