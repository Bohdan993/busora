import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'failed'
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function FailedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('failed');

  return (
    <section>
      <h1>{t('title')}</h1>
      <p>{t('text')}</p>
      <p>
        <Link href="/">{t('tryAgain')}</Link>
      </p>
    </section>
  );
}
