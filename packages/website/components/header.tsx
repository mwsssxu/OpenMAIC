'use client';

import Link from 'next/link';
import { Locale, TranslationKeys, locales } from '@/lib/i18n';
import { Globe } from 'lucide-react';

interface HeaderProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function Header({ locale, t }: HeaderProps) {
  const switchLocale = (newLocale: Locale) => {
    // 切换语言时跳转到对应路径
    window.location.href = `/${newLocale}`;
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
          <Link href={`/${locale}/login`} className="text-gray-600 hover:text-primary transition-colors">
            {t['nav.login']}
          </Link>
          <Link href={`/${locale}/register`} className="btn-primary text-sm">
            {t['nav.register']}
          </Link>
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