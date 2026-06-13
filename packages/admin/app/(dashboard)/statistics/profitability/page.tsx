'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import {
  BarChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface ProfitabilityStats {
  today: {
    revenue: number;       // 元
    cost: number;          // 元
    profit: number;        // 元
    calls: number;
    success: number;
    errors: number;
    cost_per_call: number;
  };
  revenue_trend: { date: string; revenue: number }[];
  cost_trend: { date: string; cost: number; calls: number }[];
  model_usage: { model: string; calls: number; total_cost: number; total_tokens: number }[];
  user_profit: { user_id: string; revenue: number; cost: number; profit: number }[];
}

export default function ProfitabilityPage() {
  const [stats, setStats] = useState<ProfitabilityStats | null>(null);
  const [days, setDays] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats(days);
  }, [days]);

  async function fetchStats(d: number) {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/stats/cost-revenue?days=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('权限不足：需要财务查看权限 (finance:view)');
        } else {
          setError(`加载失败 (${response.status})`);
        }
        return;
      }

      const data = await response.json();
      setStats(data);
    } catch (e) {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }

  // 合并收入与成本趋势：以日期为 key
  const trendData = (() => {
    if (!stats) return [];
    const m = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();
    for (const r of stats.revenue_trend) {
      m.set(r.date, { date: r.date, revenue: r.revenue, cost: 0, profit: r.revenue });
    }
    for (const c of stats.cost_trend) {
      const e = m.get(c.date) || { date: c.date, revenue: 0, cost: 0, profit: 0 };
      e.cost = c.cost;
      e.profit = e.revenue - c.cost;
      m.set(c.date, e);
    }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">盈利分析</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const t = stats?.today;
  const profitColor = (t?.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
  const errorRate = t && t.calls > 0 ? ((t.errors / t.calls) * 100).toFixed(1) : '0.0';
  const profitMargin = t && t.revenue > 0 ? ((t.profit / t.revenue) * 100).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">盈利分析</h1>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                days === d
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              近{d}天
            </button>
          ))}
        </div>
      </div>

      {/* 今日核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="今日收入"
          value={`¥${(t?.revenue ?? 0).toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
        />
        <KpiCard
          title="今日 API 成本"
          value={`¥${(t?.cost ?? 0).toFixed(2)}`}
          icon={<Cpu className="w-5 h-5" />}
          color="orange"
        />
        <KpiCard
          title="今日利润"
          value={`¥${(t?.profit ?? 0).toFixed(2)}`}
          subtitle={profitMargin ? `毛利率 ${profitMargin}%` : '今日暂无收入'}
          icon={
            (t?.profit ?? 0) >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )
          }
          color={(t?.profit ?? 0) >= 0 ? 'green' : 'red'}
          valueClassName={profitColor}
        />
        <KpiCard
          title="今日调用"
          value={`${t?.calls ?? 0}`}
          subtitle={`成功 ${t?.success ?? 0} · 失败率 ${errorRate}%`}
          icon={<Activity className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* 单次调用成本 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">单次调用平均成本</h2>
        <div className="text-3xl font-bold text-gray-900">
          ¥{(t?.cost_per_call ?? 0).toFixed(4)}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          基于今日成功调用计算 · 越低越好
        </div>
      </div>

      {/* 收入 vs 成本 趋势 + 利润折线 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            收入 vs 成本 (近{days}天)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `¥${v}`} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="revenue" name="收入" fill="#3b82f6" />
              <Bar dataKey="cost" name="成本" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            利润趋势 (近{days}天)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `¥${v}`} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="profit"
                name="利润"
                stroke="#10b981"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 模型使用排行 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">今日模型成本排行</h2>
        {(stats?.model_usage?.length ?? 0) === 0 ? (
          <div className="text-gray-500 text-sm">今日尚无成功调用</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2">模型</th>
                  <th className="text-right py-2">调用次数</th>
                  <th className="text-right py-2">总 Token</th>
                  <th className="text-right py-2">总成本</th>
                  <th className="text-right py-2">单次均价</th>
                </tr>
              </thead>
              <tbody>
                {stats?.model_usage.map((m) => (
                  <tr key={m.model} className="border-b border-gray-100">
                    <td className="py-2 font-mono text-xs">{m.model}</td>
                    <td className="text-right py-2">{m.calls}</td>
                    <td className="text-right py-2">{m.total_tokens.toLocaleString()}</td>
                    <td className="text-right py-2 font-medium">¥{m.total_cost.toFixed(4)}</td>
                    <td className="text-right py-2 text-gray-500">
                      ¥{(m.total_cost / Math.max(m.calls, 1)).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 用户利润 Top 10 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          用户利润 Top 10 (近{days}天)
        </h2>
        {(stats?.user_profit?.length ?? 0) === 0 ? (
          <div className="text-gray-500 text-sm">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2">用户ID</th>
                  <th className="text-right py-2">收入</th>
                  <th className="text-right py-2">成本</th>
                  <th className="text-right py-2">利润</th>
                </tr>
              </thead>
              <tbody>
                {stats?.user_profit.map((u) => (
                  <tr key={u.user_id} className="border-b border-gray-100">
                    <td className="py-2 font-mono text-xs">
                      {u.user_id.slice(0, 8)}...
                    </td>
                    <td className="text-right py-2">¥{u.revenue.toFixed(2)}</td>
                    <td className="text-right py-2">¥{u.cost.toFixed(4)}</td>
                    <td
                      className={`text-right py-2 font-semibold ${
                        u.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      ¥{u.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs text-gray-400 mt-3">
          说明：收入仅统计已支付订单 (orders.status=paid)；成本为 LLM API 直接成本，不含基础设施。
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
  valueClassName,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  valueClassName?: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className={`text-2xl font-bold mt-1 ${valueClassName || 'text-gray-900'}`}>
            {value}
          </div>
          {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
