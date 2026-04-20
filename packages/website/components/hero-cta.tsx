'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Locale } from '@/lib/i18n';
import { getToken } from '@/lib/api-client';
import { Rocket, UserPlus } from 'lucide-react';

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3031';

interface HeroCTAProps {
  locale: Locale;
}

export default function HeroCTA({ locale }: HeroCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(Boolean(token));
  }, []);

  if (isLoggedIn) {
    return (
      <a
        href={MAIN_APP_URL}
        className="btn-primary text-lg flex items-center justify-center gap-2"
      >
        <Rocket className="w-5 h-5" />
        {locale === 'zh' ? '进入应用' : 'Enter App'}
      </a>
    );
  }

  return (
    <Link href={`/${locale}/register`} className="btn-primary text-lg flex items-center justify-center gap-2">
      <UserPlus className="w-5 h-5" />
      {locale === 'zh' ? '立即体验' : 'Try Now'}
    </Link>
  );
}