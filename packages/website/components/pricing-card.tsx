import { Locale, TranslationKeys } from '@/lib/i18n';
import Link from 'next/link';
import { Check } from 'lucide-react';

interface PricingCardProps {
  package: {
    id: string;
    price: number;
    tokens: number;
    bonus: number;
    total_tokens: number;
  };
  locale: Locale;
  t: Record<TranslationKeys, string>;
  recommended?: boolean;
}

export default function PricingCard({ package: pkg, locale, t, recommended }: PricingCardProps) {
  const displayName = locale === 'en'
    ? { basic: 'Basic', standard: 'Standard', premium: 'Premium' }
    : { basic: '基础包', standard: '标准包', premium: '高级包' };

  return (
    <div
      className={`card ${recommended ? 'card-highlight relative' : ''}`}
    >
      {/* Recommended Badge */}
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-sm px-3 py-1 rounded-full">
          {t['pricing.recommended']}
        </div>
      )}

      {/* Package Name */}
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {displayName[pkg.id as keyof typeof displayName] || pkg.id}
      </h3>

      {/* Price */}
      <div className="mb-6">
        <span className="text-3xl font-bold text-gray-900">
          ¥{pkg.price}
        </span>
        <span className="text-gray-500 ml-1">
          {locale === 'zh' ? '元' : 'CNY'}
        </span>
      </div>

      {/* Tokens */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <span className="text-gray-600">
            {pkg.tokens} {t['pricing.tokens']}
          </span>
        </div>
        {pkg.bonus > 0 && (
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent" />
            <span className="text-accent font-medium">
              +{pkg.bonus} {t['pricing.bonus']}
            </span>
          </div>
        )}
        <div className="text-sm text-gray-500 pt-2 border-t">
          {t['pricing.total']}: {pkg.total_tokens} Tokens
        </div>
      </div>

      {/* Buy Button */}
      <Link
        href={`/${locale}/register`}
        className={`w-full text-center py-3 rounded-lg font-medium transition-all ${
          recommended
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {t['pricing.buy']}
      </Link>
    </div>
  );
}