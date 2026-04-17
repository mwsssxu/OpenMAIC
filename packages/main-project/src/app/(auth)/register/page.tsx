'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      setLoading(false);
      return;
    }

    try {
      await register(email, password, nickname);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-yellow-300/20 rounded-full blur-lg"></div>
      </div>

      <div className="w-full max-w-md px-4 animate-fade-in">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
              ✨
            </div>
            <h1 className="text-2xl font-bold text-gray-800">创建账号</h1>
            <p className="text-gray-500 mt-2">开启您的商业策略学习之旅</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">📧 邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-gray-700 font-medium">👤 昵称（可选）</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="您的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">🔑 密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少6个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 text-base rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="loading-spinner"></span> 注册中...
                </span>
              ) : '🎉 注册账号'}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">已有账号？</span>
            <Link href="/login" className="text-emerald-600 hover:text-teal-600 font-medium ml-1 transition-colors">
              🚀 立即登录
            </Link>
          </div>

          {/* Trial Info - 活泼礼包卡片 */}
          <div className="mt-6 bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-center mb-3">
              <span className="text-2xl">🎁</span>
              <div className="text-sm font-bold text-orange-600 mt-1">新用户专属礼包</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-lg font-bold text-indigo-600">200</div>
                <div className="text-xs text-gray-500">💎 Token</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-lg font-bold text-orange-500">500</div>
                <div className="text-xs text-gray-500">⭐ 积分</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-lg font-bold text-green-500">7天</div>
                <div className="text-xs text-gray-500">👑 会员</div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部装饰 */}
        <div className="text-center mt-6 text-white/80 text-sm">
          🌟 注册即表示同意我们的服务条款
        </div>
      </div>
    </div>
  );
}