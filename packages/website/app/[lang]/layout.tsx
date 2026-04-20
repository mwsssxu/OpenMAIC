import { Locale, locales, defaultLocale, getTranslations } from '@/lib/i18n';
import Header from '@/components/header';
import Footer from '@/components/footer';

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await Promise.resolve(params);
  const locale: Locale = locales.includes(lang as Locale) ? (lang as Locale) : defaultLocale;
  const t = getTranslations(locale);

  return (
    <>
      <Header locale={locale} t={t} />
      <main className="pt-16">{children}</main>
      <Footer locale={locale} t={t} />
    </>
  );
}