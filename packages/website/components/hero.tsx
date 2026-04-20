import { Locale, TranslationKeys } from '@/lib/i18n';
import { Sparkles } from 'lucide-react';
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
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

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
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">200+</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '新用户Token' : 'New User Tokens'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">6+</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '核心功能' : 'Core Features'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">3+</div>
            <div className="text-sm text-gray-500">
              {locale === 'zh' ? '学习搭子类型' : 'Buddy Types'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}