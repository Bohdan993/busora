import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SearchForm } from '@/components/search/SearchForm';
import { SearchFormFromUrl } from '@/components/search/SearchFormFromUrl';
import { PHONES_CZ, PHONES_UA, tel } from '@/content/company';

export async function Hero() {
  const t = await getTranslations('home.hero');

  return (
    <section className="section hero">
      <div>
        <h1>{t('title')}</h1>
        <p>{t('text')}</p>
        <h2>{t('phones')}</h2>
        <ul>
          {[...PHONES_UA, ...PHONES_CZ].map((phone) => (
            <li key={phone}>
              <a href={tel(phone)}>{phone}</a>
            </li>
          ))}
        </ul>
      </div>
      <div id="search">
        {/* The query string is only known at request time */}
        <Suspense fallback={<SearchForm />}>
          <SearchFormFromUrl />
        </Suspense>
      </div>
    </section>
  );
}
