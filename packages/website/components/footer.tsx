import Link from 'next/link';
import { Locale, TranslationKeys } from '@/lib/i18n';

interface FooterProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function Footer({ locale, t }: FooterProps) {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">伴</span>
              </div>
              <span className="font-semibold text-lg text-gray-900">侧伴</span>
            </div>
            <p className="text-gray-500 text-sm">
              {locale === 'zh' ? 'AI 多智能体互动课堂' : 'AI Multi-Agent Interactive Classroom'}
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">
              {locale === 'zh' ? '产品' : 'Product'}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}`} className="text-gray-500 hover:text-primary">{t['nav.home']}</Link></li>
              <li><Link href={`/${locale}/pricing`} className="text-gray-500 hover:text-primary">{t['nav.pricing']}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">
              {locale === 'zh' ? '账户' : 'Account'}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/${locale}/login`} className="text-gray-500 hover:text-primary">{t['nav.login']}</Link></li>
              <li><Link href={`/${locale}/register`} className="text-gray-500 hover:text-primary">{t['nav.register']}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">
              {locale === 'zh' ? '关于' : 'About'}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><span className="text-gray-500">{t['footer.about']}</span></li>
              <li><span className="text-gray-500">{t['footer.contact']}</span></li>
              <li><span className="text-gray-500">{t['footer.privacy']}</span></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          {t['footer.copyright']}
        </div>
      </div>
    </footer>
  );
}