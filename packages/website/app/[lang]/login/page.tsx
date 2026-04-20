import { Locale, getTranslations } from '@/lib/i18n';
import LoginPage from '@/components/login-page';

export default async function LoginRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = ['zh', 'en'].includes(lang) ? lang as Locale : 'zh';
  const t = getTranslations(locale);

  return <LoginPage locale={locale} t={t} />;
}