'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Locale, TranslationKeys } from '@/lib/i18n';
import { login, saveToken } from '@/lib/api-client';
import { Eye, EyeOff, LogIn } from 'lucide-react';

// 主应用入口
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

interface LoginPageProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function LoginPage({ locale, t }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const response = await login(email, password);

    if (response.data) {
      saveToken(response.data.accessToken);
      // 跳转到主应用
      window.location.href = MAIN_APP_URL;
    } else {
      setError(response.error || t['login.error']);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gradient-to-b from-white to-blue-50 animate-fadeIn">
      <div className="card max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t['login.title']}</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t['login.email']}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t['login.password']}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '...' : t['login.submit']}
          </button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center text-gray-600">
          {t['login.register'].split('？')[0]}？
          <Link href={`/${locale}/register`} className="text-primary font-medium ml-1">
            {locale === 'zh' ? '立即注册' : 'Sign up'}
          </Link>
        </div>
      </div>
    </div>
  );
}