'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Locale, TranslationKeys, locales } from '@/lib/i18n';
import { getToken, clearToken } from '@/lib/api-client';
import { Globe, LogOut, Rocket } from 'lucide-react';

// 主应用入口
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

interface HeaderProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function Header({ locale, t }: HeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 检查登录状态
    const token = getToken();
    setIsLoggedIn(Boolean(token));
  }, []);

  const switchLocale = (newLocale: Locale) => {
    window.location.href = `/${newLocale}`;
  };

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    window.location.reload();
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">伴</span>
          </div>
          <span className="font-semibold text-lg text-gray-900">侧伴</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href={`/${locale}`} className="text-gray-600 hover:text-primary transition-colors">
            {t['nav.home']}
          </Link>
          <Link href={`/${locale}/pricing`} className="text-gray-600 hover:text-primary transition-colors">
            {t['nav.pricing']}
          </Link>
          {isLoggedIn ? (
            <>
              <a
                href={MAIN_APP_URL}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <Rocket className="w-4 h-4" />
                {locale === 'zh' ? '进入应用' : 'Enter App'}
              </a>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                {locale === 'zh' ? '退出' : 'Logout'}
              </button>
            </>
          ) : (
            <>
              <Link href={`/${locale}/login`} className="text-gray-600 hover:text-primary transition-colors">
                {t['nav.login']}
              </Link>
              <Link href={`/${locale}/register`} className="btn-primary text-sm">
                {t['nav.register']}
              </Link>
            </>
          )}
        </nav>

        {/* Language Switch */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value as Locale)}
            className="bg-transparent text-sm text-gray-600 cursor-pointer outline-none"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {t[`lang.${l}` as TranslationKeys]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}