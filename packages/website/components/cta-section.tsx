'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Locale, TranslationKeys } from '@/lib/i18n';
import { getToken } from '@/lib/api-client';
import { Rocket, UserPlus, CreditCard } from 'lucide-react';

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3031';

interface CTASectionProps {
  locale: Locale;
  t?: Record<TranslationKeys, string>;
}

export default function CTASection({ locale, t }: CTASectionProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(Boolean(token));
  }, []);

  return (
    <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t ? t['cta.title'] : (locale === 'zh' ? '开启你的 AI 学习之旅' : 'Start Your AI Learning Journey')}
        </h2>
        <p className="text-gray-600 mb-8">
          {t ? t['cta.subtitle'] : (locale === 'zh' ? '新用户注册即送 200 Token + 500 积分' : 'New users get 200 Tokens + 500 Points')}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          {isLoggedIn ? (
            <a
              href={MAIN_APP_URL}
              className="btn-primary flex items-center gap-2"
            >
              <Rocket className="w-5 h-5" />
              {locale === 'zh' ? '进入应用' : 'Enter App'}
            </a>
          ) : (
            <Link href={`/${locale}/register`} className="btn-primary flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t ? t['cta.primary'] : (locale === 'zh' ? '立即注册' : 'Sign Up Free')}
            </Link>
          )}
          <Link href={`/${locale}/pricing`} className="btn-accent flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {locale === 'zh' ? '查看价格' : 'View Pricing'}
          </Link>
        </div>
      </div>
    </section>
  );
}
