'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Locale, TranslationKeys } from '@/lib/i18n';
import { register, saveToken } from '@/lib/api-client';
import { Eye, EyeOff, UserPlus, Gift, Rocket } from 'lucide-react';

// 主应用入口
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

interface RegisterPageProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function RegisterPage({ locale, t }: RegisterPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const response = await register(email, password, nickname);

    if (response.data) {
      saveToken(response.data.accessToken);
      setSuccess(true);
    } else {
      setError(response.error || t['register.error']);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gradient-to-b from-white to-blue-50">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-success rounded-xl flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'zh' ? '注册成功！' : 'Success!'}
          </h1>
          <div className="bg-accent/10 text-accent px-4 py-3 rounded-lg mb-4 flex items-center justify-center gap-2">
            <Gift className="w-5 h-5" />
            <span className="font-medium">{t['register.success']}</span>
          </div>
          <a href={MAIN_APP_URL} className="btn-primary inline-block flex items-center justify-center gap-2">
            <Rocket className="w-5 h-5" />
            {locale === 'zh' ? '开始探索' : 'Start Exploring'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-gradient-to-b from-white to-blue-50 animate-fadeIn">
      <div className="card max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t['register.title']}</h1>
          {/* Gift Hint */}
          <div className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-1">
            <Gift className="w-4 h-4 text-accent" />
            <span>{locale === 'zh' ? '新用户礼包：200 Token + 500 积分' : 'New user gift: 200 Tokens + 500 Points'}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t['register.nickname']}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder={locale === 'zh' ? '你的昵称' : 'Your nickname'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t['register.email']}
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
              {t['register.password']}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
            {loading ? '...' : t['register.submit']}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center text-gray-600">
          {t['register.login'].split('？')[0]}？
          <Link href={`/${locale}/login`} className="text-primary font-medium ml-1">
            {locale === 'zh' ? '立即登录' : 'Login'}
          </Link>
        </div>
      </div>
    </div>
  );
}