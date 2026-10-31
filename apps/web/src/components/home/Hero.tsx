import { Suspense } from 'react';
import { Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { SearchForm } from '@/components/search/SearchForm';
import { SearchFormFromUrl } from '@/components/search/SearchFormFromUrl';
import { PHONES_CZ, PHONES_UA, tel } from '@/content/company';
import styles from './Hero.module.css';

export async function Hero() {
  const t = await getTranslations('home.hero');

  return (
    <section className={styles.hero}>
      <span className="badge badge-highlight badge-large">{t('badge')}</span>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={`lead ${styles.text}`}>{t('text')}</p>
      <div id="search" className={`bleed ${styles.band}`}>
        <div className={styles.bandInner}>
          {/* The query string is only known at request time */}
          <Suspense fallback={<SearchForm />}>
            <SearchFormFromUrl />
          </Suspense>
          <div className={styles.phones}>
            <h2>{t('phones')}</h2>
            <ul>
              {[...PHONES_UA, ...PHONES_CZ].map((phone) => (
                <li key={phone}>
                  <a href={tel(phone)}>
                    <Phone size={16} aria-hidden="true" />
                    {phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
