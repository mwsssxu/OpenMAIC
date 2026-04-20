import Link from 'next/link';
import { Locale, getTranslations } from '@/lib/i18n';
import Hero from '@/components/hero';
import Features from '@/components/features';

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = ['zh', 'en'].includes(lang) ? lang as Locale : 'zh';
  const t = getTranslations(locale);

  return (
    <div className="animate-fadeIn">
      {/* Hero Section */}
      <Hero locale={locale} t={t} />

      {/* Features Section */}
      <Features locale={locale} t={t} />

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {locale === 'zh' ? '开始你的学习之旅' : 'Start Your Learning Journey'}
          </h2>
          <p className="text-gray-600 mb-8">
            {locale === 'zh'
              ? '新用户注册即送 200 Token + 500 积分'
              : 'New users get 200 Tokens + 500 Points'}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={`/${locale}/register`} className="btn-primary">
              {t['hero.cta']}
            </Link>
            <Link href={`/${locale}/pricing`} className="btn-accent">
              {t['nav.pricing']}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}