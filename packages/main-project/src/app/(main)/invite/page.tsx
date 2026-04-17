'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function InvitePage() {
  const [inviteCode, setInviteCode] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [codeData, statsData] = await Promise.all([
        apiClient.getMyInviteCode(),
        apiClient.getInviteStats(),
      ]);
      setInviteCode(codeData.invite_code || '');
      setStats(codeData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    alert('邀请码已复制');
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">邀请好友</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-medium mb-4">我的邀请码</h2>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-blue-500">{inviteCode}</div>
            <button
              onClick={copyCode}
              className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            >
              复制
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            分享邀请码给好友，好友注册后双方都能获得奖励
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-medium mb-4">邀请奖励</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-green-50 rounded">
              <span>一级邀请（直接邀请）</span>
              <span className="text-green-600 font-medium">20积分 + 50 Token</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded">
              <span>二级邀请</span>
              <span className="text-blue-600 font-medium">10积分</span>
            </div>
            <div className="flex justify-between p-3 bg-purple-50 rounded">
              <span>三级邀请</span>
              <span className="text-purple-600 font-medium">5积分</span>
            </div>
            <div className="flex justify-between p-3 bg-orange-50 rounded">
              <span>被邀请人获得</span>
              <span className="text-orange-600 font-medium">100 Token</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-medium mb-4">我的邀请统计</h2>
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{stats.total_invites || 0}</div>
                <div className="text-sm text-gray-500">邀请人数</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{stats.total_points_earned || 0}</div>
                <div className="text-sm text-gray-500">获得积分</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">{stats.total_tokens_earned || 0}</div>
                <div className="text-sm text-gray-500">获得 Token</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}