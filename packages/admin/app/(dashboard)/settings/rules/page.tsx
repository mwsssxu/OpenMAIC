'use client';

import { useEffect, useState } from 'react';
import { Save, Gift, BookOpen, Star, Users } from 'lucide-react';

interface RewardRule {
  action: string;
  points: number;
  description: string;
  enabled: boolean;
}

interface RulesConfig {
  rewards: RewardRule[];
  daily_task_bonus: number;
  streak_multiplier: number;
  review_points: { type: string; points: number }[];
}

export default function RulesSettingsPage() {
  const [config, setConfig] = useState<RulesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/settings/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setError('加载失败，请稍后重试');
      }
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      await fetch(`${apiUrl}/admin/settings/rules`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
    } catch {
      setError('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  }

  function updateReward(index: number, field: keyof RewardRule, value: string | number | boolean) {
    if (!config) return;
    setConfig({
      ...config,
      rewards: config.rewards.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    });
  }

  function updateReviewPoints(index: number, points: number) {
    if (!config) return;
    setConfig({
      ...config,
      review_points: config.review_points.map((r, i) => (i === index ? { ...r, points } : r)),
    });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">规则配置</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 积分奖励规则 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">积分奖励规则</h2>
        </div>

        <div className="space-y-3">
          {config?.rewards?.map((rule, index) => (
            <div key={rule.action} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => updateReward(index, 'enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{rule.description}</div>
                  <div className="text-xs text-gray-500">{rule.action}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rule.points}
                  onChange={(e) => updateReward(index, 'points', parseInt(e.target.value))}
                  className="w-20 px-3 py-1 border border-gray-300 rounded-lg text-right"
                />
                <span className="text-sm text-gray-600">积分</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 每日任务奖励 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-6 h-6 text-yellow-600" />
          <h2 className="text-lg font-semibold text-gray-900">每日任务奖励</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">每日任务完成奖励</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config?.daily_task_bonus || 0}
                onChange={(e) => setConfig(prev => prev ? { ...prev, daily_task_bonus: parseInt(e.target.value) } : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-sm text-gray-600">积分</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">连续打卡奖励倍数</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={config?.streak_multiplier || 1}
                onChange={(e) => setConfig(prev => prev ? { ...prev, streak_multiplier: parseFloat(e.target.value) } : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-sm text-gray-600">倍</span>
            </div>
          </div>
        </div>
      </div>

      {/* 复习系统积分 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">复习系统积分奖励</h2>
        </div>

        <div className="space-y-3">
          {config?.review_points?.map((rule, index) => (
            <div key={rule.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-900">{rule.type}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rule.points}
                  onChange={(e) => updateReviewPoints(index, parseInt(e.target.value))}
                  className="w-20 px-3 py-1 border border-gray-300 rounded-lg text-right"
                />
                <span className="text-sm text-gray-600">积分</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}