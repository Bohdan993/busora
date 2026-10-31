import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <section className="page">
      <h1>{t('title')}</h1>
      <p>
        <Link href="/">{t('home')}</Link>
      </p>
    </section>
  );
}
