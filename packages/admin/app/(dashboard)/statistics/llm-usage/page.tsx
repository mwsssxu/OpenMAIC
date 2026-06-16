'use client';

import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface LLMRecord {
  id: string;
  provider: string;
  model: string;
  scene_type?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_yuan: number;
  duration_ms?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export default function LLMUsagePage() {
  const [records, setRecords] = useState<LLMRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterModel, setFilterModel] = useState('');
  const [filterScene, setFilterScene] = useState('');

  useEffect(() => {
    fetchUsage();
  }, [page, filterModel, filterScene]);

  async function fetchUsage() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterModel) params.set('model', filterModel);
      if (filterScene) params.set('scene_type', filterScene);

      const res = await fetch(`${API_BASE}/api/admin/llm-usage?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setSummary(data.summary || {});
      }
    } catch (e) {
      console.error('Failed to fetch LLM usage:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">LLM 用量明细</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterModel}
            onChange={e => { setFilterModel(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部模型</option>
            <option value="qwen3.6-plus">qwen3.6-plus</option>
            <option value="qwen-turbo">qwen-turbo</option>
            <option value="qwen3.7-max">qwen3.7-max</option>
            <option value="deepseek-chat">deepseek-chat</option>
          </select>
          <select
            value={filterScene}
            onChange={e => { setFilterScene(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">全部场景</option>
            <option value="course_generation">课程生成</option>
            <option value="agent_discussion">Agent讨论</option>
            <option value="tts">TTS</option>
            <option value="buddy_deep_chat">搭子对话</option>
          </select>
        </div>
      </div>

      {/* 汇总卡片 */}
      {summary.total_calls > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">总调用次数</div>
            <div className="text-lg font-bold text-gray-900">{Number(summary.total_calls).toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">总 Token 数</div>
            <div className="text-lg font-bold text-gray-900">{Number(summary.total_tokens).toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">总成本</div>
            <div className="text-lg font-bold text-red-600">¥{Number(summary.total_cost).toFixed(4)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">平均耗时</div>
            <div className="text-lg font-bold text-gray-900">{Math.round(Number(summary.avg_duration))}ms</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-3 text-left font-medium">模型</th>
                <th className="px-3 py-3 text-left font-medium">场景</th>
                <th className="px-3 py-3 text-left font-medium">Prompt</th>
                <th className="px-3 py-3 text-left font-medium">Completion</th>
                <th className="px-3 py-3 text-left font-medium">成本(¥)</th>
                <th className="px-3 py-3 text-left font-medium">耗时</th>
                <th className="px-3 py-3 text-left font-medium">状态</th>
                <th className="px-3 py-3 text-left font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs">{r.model}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{r.scene_type || '-'}</td>
                  <td className="px-3 py-3 text-xs">{r.prompt_tokens.toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs">{r.completion_tokens.toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs font-medium text-red-600">{r.cost_yuan.toFixed(6)}</td>
                  <td className="px-3 py-3 text-xs">{r.duration_ms ? `${r.duration_ms}ms` : '-'}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-2 rounded-lg border text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-gray-600">{page} / {totalPages}（共 {total} 条）</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-2 rounded-lg border text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}
