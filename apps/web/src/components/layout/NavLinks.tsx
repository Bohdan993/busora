'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { NAV_ITEMS } from './navItems';
import styles from './SiteHeader.module.css';

export function NavLinks() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('menu')} className={styles.nav}>
      <ul>
        {NAV_ITEMS.map(({ href, key }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
