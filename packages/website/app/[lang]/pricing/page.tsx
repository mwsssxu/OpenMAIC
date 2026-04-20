import { Locale, TranslationKeys, getTranslations } from '@/lib/i18n';
import { getPackages, Package } from '@/lib/api-client';
import PricingCard from '@/components/pricing-card';
import { Sparkles, Check } from 'lucide-react';

// 预定义套餐（当API不可用时使用）
const defaultPackages: Package[] = [
  { id: 'basic', price: 10, tokens: 100, bonus: 0, total_tokens: 100 },
  { id: 'standard', price: 50, tokens: 500, bonus: 100, total_tokens: 600 },
  { id: 'premium', price: 100, tokens: 1000, bonus: 500, total_tokens: 1500 },
];

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = ['zh', 'en'].includes(lang) ? lang as Locale : 'zh';
  const t = getTranslations(locale);

  // 尝试获取套餐数据
  const response = await getPackages();
  const packages = response.data || defaultPackages;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-20 px-4 animate-fadeIn">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t['pricing.title']}
          </h1>
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">{t['pricing.subtitle']}</span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packages.map((pkg, index) => (
            <PricingCard
              key={pkg.id}
              package={pkg}
              locale={locale}
              t={t}
              recommended={index === 1}
            />
          ))}
        </div>

        {/* Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p className="mb-2">
            {locale === 'zh'
              ? 'Token可用于购买课程、笔记、发布悬赏'
              : 'Tokens can be used for courses, notes, and bounties'}
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-success" />
              {locale === 'zh' ? '安全支付' : 'Secure Payment'}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-success" />
              {locale === 'zh' ? '即时到账' : 'Instant Delivery'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}