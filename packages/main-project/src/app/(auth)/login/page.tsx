'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-pink-300/20 rounded-full blur-lg"></div>
      </div>

      <div className="w-full max-w-md px-4 animate-fade-in">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Header - 活泼Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
              🎯
            </div>
            <h1 className="text-2xl font-bold text-gray-800">OpenMAIC Business</h1>
            <p className="text-gray-500 mt-2">✨ 商业策略研究平台</p>
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
              <Label htmlFor="password" className="text-gray-700 font-medium">🔑 密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-primary py-3 text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="loading-spinner"></span> 登录中...
                </span>
              ) : '🚀 登录'}
            </Button>
          </form>

          {/* OAuth */}
          <div className="mt-6">
            <div className="text-center text-sm text-gray-500 mb-4 flex items-center justify-center gap-2">
              <span>─────</span> 或使用其他方式登录 <span>─────</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="w-full flex items-center gap-2 hover:bg-gray-100" disabled>
                <span>🔵</span> Google
              </Button>
              <Button variant="outline" className="w-full flex items-center gap-2 hover:bg-gray-100" disabled>
                <span>🍎</span> Apple
              </Button>
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">还没有账号？</span>
            <Link href="/register" className="text-indigo-600 hover:text-purple-600 font-medium ml-1 transition-colors">
              ✨ 立即注册
            </Link>
          </div>
        </div>

        {/* 底部装饰 */}
        <div className="text-center mt-6 text-white/80 text-sm">
          🌟 AI驱动的交互式学习体验
        </div>
      </div>
    </div>
  );
}