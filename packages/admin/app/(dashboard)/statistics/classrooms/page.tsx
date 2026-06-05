'use client';

import { useEffect, useState } from 'react';
import { BookOpen, FileText, TrendingUp, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ClassroomStats {
  total_courses: number;
  generated_today: number;
  avg_completion_rate: number;
  popular_tags: { tag: string; count: number }[];
  generation_trend: { date: string; courses: number; completions: number }[];
}

export default function ClassroomStatsPage() {
  const [stats, setStats] = useState<ClassroomStats | null>(null);
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

      const response = await fetch(`${apiUrl}/admin/statistics/classrooms`, {
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
      <h1 className="text-2xl font-bold text-gray-900">课程统计</h1>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-sm text-gray-500">总课程数</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.total_courses}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm text-gray-500">今日生成</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.generated_today}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-sm text-gray-500">平均完成率</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.avg_completion_rate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 生成趋势 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">课程生成趋势 (近7天)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats?.generation_trend}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="courses" fill="#3b82f6" name="生成课程" />
            <Bar dataKey="completions" fill="#10b981" name="完成课程" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 热门标签 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">热门课程标签</h2>
        <div className="space-y-3">
          {stats?.popular_tags?.map((item, index) => (
            <div key={item.tag} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-8">{index + 1}</span>
                <span className="text-sm font-medium text-gray-900">{item.tag}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-2 bg-blue-600 rounded-full"
                    style={{ width: `${(item.count / 1200) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}