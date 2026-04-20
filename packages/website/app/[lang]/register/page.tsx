import { Locale, getTranslations } from '@/lib/i18n';
import RegisterPage from '@/components/register-page';

export default async function RegisterRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = ['zh', 'en'].includes(lang) ? lang as Locale : 'zh';
  const t = getTranslations(locale);

  return <RegisterPage locale={locale} t={t} />;
}