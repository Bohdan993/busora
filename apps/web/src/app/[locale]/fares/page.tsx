import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { FaresTables } from '@/components/network/FaresTables';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'faresPage'
  });
  return { title: t('title') };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations();

  return (
    <>
      <div className="page-head">
        <h1>{t('faresPage.title')}</h1>
        <p className="lead muted">{t('faresPage.intro')}</p>
      </div>
      <FaresTables />
    </>
  );
}
