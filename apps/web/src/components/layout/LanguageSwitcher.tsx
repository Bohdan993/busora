'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import styles from './SiteHeader.module.css';

export function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: Locale) =>
    // Keep the query (e.g. a search) when switching language
    router.replace(`${pathname}${window.location.search}`, { locale: next });

  return (
    <label className={styles.language}>
      <span className="visually-hidden">{t('language')}</span>
      <select
        value={locale}
        onChange={(event) => switchTo(event.target.value as Locale)}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {t(`languages.${code}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
