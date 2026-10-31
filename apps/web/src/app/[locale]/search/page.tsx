import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchResults } from '@/components/booking/SearchResults';
import type { Locale } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'search'
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('common');

  return (
    // The results read the query string, which is only known at request time
    <Suspense fallback={<p>{t('loading')}</p>}>
      <SearchResults />
    </Suspense>
  );
}
