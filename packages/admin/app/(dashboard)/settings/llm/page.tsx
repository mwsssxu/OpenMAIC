'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCw, Cpu, Zap } from 'lucide-react';

interface LLMConfig {
  provider: string;
  model: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
}

export default function LLMSettingsPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/settings/llm`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      } else {
        setConfigs(getMockConfigs());
      }
    } catch {
      setConfigs(getMockConfigs());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockConfigs(): LLMConfig[] {
    return [
      { provider: 'openai', model: 'gpt-4o', api_key: '', temperature: 0.7, max_tokens: 2000, top_p: 0.9 },
      { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', api_key: '', temperature: 0.8, max_tokens: 4000, top_p: 0.95 },
      { provider: 'deepseek', model: 'deepseek-chat', api_key: '', temperature: 0.7, max_tokens: 3000, top_p: 0.9 },
    ];
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      await fetch(`${apiUrl}/admin/settings/llm`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      });
    } catch {
      // 模拟保存成功
    } finally {
      setIsSaving(false);
    }
  }

  function updateConfig(index: number, field: keyof LLMConfig, value: string | number) {
    setConfigs(configs.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">LLM 配置</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfigs}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 配置列表 */}
      <div className="space-y-4">
        {configs.map((config, index) => (
          <div key={config.provider} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{config.provider}</h2>
              <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">{config.model}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => updateConfig(index, 'model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={config.api_key}
                  onChange={(e) => updateConfig(index, 'api_key', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => updateConfig(index, 'temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-600 w-12">{config.temperature}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={config.max_tokens}
                  onChange={(e) => updateConfig(index, 'max_tokens', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Top P</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.top_p}
                    onChange={(e) => updateConfig(index, 'top_p', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-600 w-12">{config.top_p}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 添加新配置 */}
      <div className="bg-white rounded-lg shadow p-6">
        <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <Zap className="w-4 h-4" />
          添加新的 LLM 配置
        </button>
      </div>
    </div>
  );
}