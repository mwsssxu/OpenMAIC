import { Locale, getTranslations } from '@/lib/i18n';
import Hero from '@/components/hero';
import Features from '@/components/features';
import CTASection from '@/components/cta-section';

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
      <CTASection locale={locale} />
    </div>
  );
}