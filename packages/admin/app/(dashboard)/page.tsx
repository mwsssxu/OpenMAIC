'use client';

import { useEffect, useState } from 'react';
import { Users, BookOpen, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DashboardStats {
  users: { total: number; new_today: number; active_today: number };
  courses: { total: number; generated_today: number };
  economy: { revenue_today: number; tokens_purchased: number; points_earned: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

      const response = await fetch(`${apiUrl}/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('加载失败，请稍后重试');
      }
    } catch (error) {
      setError('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总用户数"
          value={stats?.users?.total || 0}
          icon={<Users className="w-6 h-6" />}
          change={stats?.users?.change || 0}
          changeLabel="较上周"
        />
        <StatCard
          title="今日新增"
          value={stats?.users?.new_today || 0}
          icon={<Users className="w-6 h-6" />}
          change={stats?.users?.change || 0}
          changeLabel="较上周"
        />
        <StatCard
          title="总课程数"
          value={stats?.courses?.total || 0}
          icon={<BookOpen className="w-6 h-6" />}
          change={stats?.courses?.change || 0}
          changeLabel="较上周"
        />
        <StatCard
          title="今日收入"
          value={`¥${((stats?.economy?.revenue_today || 0) / 100).toFixed(2)}`}
          icon={<DollarSign className="w-6 h-6" />}
          change={stats?.economy?.change || 0}
          changeLabel="较上周"
        />
      </div>

      {/* 活跃数据 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">今日活跃数据</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {stats?.users?.active_today || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">活跃用户</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {stats?.courses?.generated_today || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">生成课程</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {stats?.economy?.tokens_purchased || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">Token购买</div>
          </div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速入口</h2>
        <div className="flex gap-4">
          <a href="/users" className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
            用户管理
          </a>
          <a href="/content/questions" className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
            内容审核
          </a>
          <a href="/statistics/users" className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
            数据统计
          </a>
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
  changeLabel,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change: number;
  changeLabel: string;
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
      <div className="mt-2 text-xs text-gray-500">{changeLabel}</div>
    </div>
  );
}