import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { RoutesTable } from '@/components/network/RoutesTable';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'routesPage'
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
        <h1>{t('routesPage.title')}</h1>
        <p className="lead muted">{t('routesPage.intro')}</p>
      </div>
      {/* Filters start from the query string, known only at request time */}
      <Suspense fallback={<p>{t('common.loading')}</p>}>
        <RoutesTable />
      </Suspense>
      <section className="section prose">
        <h2>{t('routesPage.infoTitle')}</h2>
        {(t.raw('routesPage.info') as string[]).map((text) => (
          <p key={text}>{text}</p>
        ))}
      </section>
    </>
  );
}
