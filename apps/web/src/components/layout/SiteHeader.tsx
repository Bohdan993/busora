import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavLinks } from './NavLinks';
import styles from './SiteHeader.module.css';

export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <>
      <aside className={styles.banner} aria-label={t('common.demoBadge')}>
        <span className="badge badge-highlight">{t('common.demoBadge')}</span>
        {t('common.demoBanner')}
      </aside>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.brand}>
            <Image src="/logo.png" alt="" width={36} height={36} priority />
            <span>{t('common.brand')}</span>
          </Link>
          <NavLinks />
          <div className={styles.end}>
            <LanguageSwitcher />
            <Link href="/#search" className="button button-dark button-small">
              {t('nav.book')}
              <span className="button-arrow" aria-hidden="true">
                <ArrowRight size={16} strokeWidth={2.25} />
              </span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
