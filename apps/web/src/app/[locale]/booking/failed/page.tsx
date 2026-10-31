import type { Metadata } from 'next';
import { X } from 'lucide-react';
import styles from '@/components/booking/booking.module.css';
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
    <section className={`card card-raised ${styles.centered}`}>
      <span className={`${styles.statusIcon} ${styles.statusNegative}`}>
        <X size={36} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <h1>{t('title')}</h1>
      <p className="lead muted">{t('text')}</p>
      <Link href="/" className="button button-block">
        {t('tryAgain')}
      </Link>
    </section>
  );
}
