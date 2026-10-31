import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <section className="not-found">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>{t('title')}</h1>
      <p>
        <Link href="/" className="button">
          {t('home')}
        </Link>
      </p>
    </section>
  );
}
