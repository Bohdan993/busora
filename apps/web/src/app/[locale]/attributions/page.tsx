import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import credits from '@/content/imageCredits.json';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'attributionsPage'
  });
  return { title: t('title') };
}

export default async function AttributionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('attributionsPage');

  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <ul>
        {credits.map((credit) => (
          <li key={credit.src}>
            <strong>{credit.subject}</strong> — {credit.title},{' '}
            {t('by', { author: credit.author })},{' '}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} rel="license">
                {credit.license}
              </a>
            ) : (
              credit.license
            )}
            . <a href={credit.sourceUrl}>{t('source')}</a>
          </li>
        ))}
      </ul>
    </>
  );
}
