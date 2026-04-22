import Image from 'next/image';
import { Locale, TranslationKeys } from '@/lib/i18n';
import HeroCTA from './hero-cta';

interface HeroProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function Hero({ locale, t }: HeroProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo */}
        <Image
          src="/ceban.png"
          alt="侧伴"
          width={64}
          height={64}
          className="mx-auto mb-8 shadow-lg rounded-2xl"
        />

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          {t['hero.title']}
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          {t['hero.subtitle']}
        </p>

        {/* CTA */}
        <div className="flex gap-4 justify-center mb-12">
          <HeroCTA locale={locale} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">231</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? 'API 端点' : 'API Endpoints'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">62</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '数据库表' : 'Database Tables'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">67</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '前端页面' : 'Frontend Pages'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">6+</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '核心功能' : 'Core Features'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
