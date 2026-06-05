'use client';

import { useEffect, useState } from 'react';
import { Save, Coins, Gift, DollarSign } from 'lucide-react';

interface PricingConfig {
  type: string;
  name: string;
  price: number;
  tokens: number;
  description: string;
}

export default function PricingSettingsPage() {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/settings/pricing`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data.pricing || []);
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

      await fetch(`${apiUrl}/admin/settings/pricing`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pricing: configs }),
      });
    } catch {
      setError('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  }

  function updateConfig(index: number, field: keyof PricingConfig, value: string | number) {
    setConfigs(configs.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">价格配置</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* Token 包配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Coins className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Token 包定价</h2>
        </div>

        <div className="space-y-4">
          {configs.filter(c => c.type === 'token_pack').map((config, idx) => {
            const index = configs.indexOf(config);
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => updateConfig(index, 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.price}
                    onChange={(e) => updateConfig(index, 'price', parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token 数量</label>
                  <input
                    type="number"
                    value={config.tokens}
                    onChange={(e) => updateConfig(index, 'tokens', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={config.description}
                    onChange={(e) => updateConfig(index, 'description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 会员订阅配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">会员订阅定价</h2>
        </div>

        <div className="space-y-4">
          {configs.filter(c => c.type === 'subscription').map((config, idx) => {
            const index = configs.indexOf(config);
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => updateConfig(index, 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">月费 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.price}
                    onChange={(e) => updateConfig(index, 'price', parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每月赠送 Token</label>
                  <input
                    type="number"
                    value={config.tokens}
                    onChange={(e) => updateConfig(index, 'tokens', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={config.description}
                    onChange={(e) => updateConfig(index, 'description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 积分奖励配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">积分奖励配置</h2>
        </div>
        <div className="text-sm text-gray-500">
          积分奖励规则在"规则配置"页面设置
        </div>
      </div>
    </div>
  );
}