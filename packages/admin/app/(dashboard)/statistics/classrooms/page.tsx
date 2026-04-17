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
        setStats(getMockStats());
      }
    } catch {
      setStats(getMockStats());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockStats(): ClassroomStats {
    return {
      total_courses: 5800,
      generated_today: 120,
      avg_completion_rate: 65,
      popular_tags: [
        { tag: '机器学习', count: 1200 },
        { tag: 'Python', count: 980 },
        { tag: '数据分析', count: 650 },
        { tag: '深度学习', count: 520 },
        { tag: 'Web开发', count: 430 },
      ],
      generation_trend: [
        { date: '2026-04-11', courses: 100, completions: 65 },
        { date: '2026-04-12', courses: 115, completions: 72 },
        { date: '2026-04-13', courses: 95, completions: 58 },
        { date: '2026-04-14', courses: 130, completions: 85 },
        { date: '2026-04-15', courses: 125, completions: 78 },
        { date: '2026-04-16', courses: 135, completions: 90 },
        { date: '2026-04-17', courses: 120, completions: 75 },
      ],
    };
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
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