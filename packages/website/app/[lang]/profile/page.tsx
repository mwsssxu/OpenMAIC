import { Locale, getTranslations } from '@/lib/i18n';
import ProfilePage from '@/components/profile-page';

export default async function ProfileRoute({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = ['zh', 'en'].includes(lang) ? lang as Locale : 'zh';
  const t = getTranslations(locale);

  return <ProfilePage locale={locale} t={t} />;
}