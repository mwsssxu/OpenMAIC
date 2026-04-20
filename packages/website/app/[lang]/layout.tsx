import { Locale, locales, defaultLocale, getTranslations } from '@/lib/i18n';
import Header from '@/components/header';
import Footer from '@/components/footer';
import '../globals.css';

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
  // 异步获取 params
  const { lang } = await Promise.resolve(params);
  const locale: Locale = locales.includes(lang as Locale) ? (lang as Locale) : defaultLocale;
  const t = getTranslations(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white">
        <Header locale={locale} t={t} />
        <main className="pt-16">{children}</main>
        <Footer locale={locale} t={t} />
      </body>
    </html>
  );
}