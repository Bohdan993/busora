import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { PHONES_CZ, PHONES_UA, tel } from '@/content/company';
import { Link } from '@/i18n/navigation';
import { NAV_ITEMS } from './navItems';
import styles from './SiteFooter.module.css';

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <p className={styles.brand}>
            <Image src="/logo.png" alt="" width={32} height={32} />
            {t('common.brand')}
          </p>
          <p>{t('home.hero.title')}</p>
        </div>
        <nav aria-label={t('footer.navigation')}>
          <h2>{t('footer.navigation')}</h2>
          <ul>
            {NAV_ITEMS.map(({ href, key }) => (
              <li key={key}>
                <Link href={href}>{t(`nav.${key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="footer-contacts">
          <h2 id="footer-contacts">{t('footer.contacts')}</h2>
          <ul>
            {[...PHONES_UA, ...PHONES_CZ].map((phone) => (
              <li key={phone}>
                <a href={tel(phone)}>{phone}</a>
              </li>
            ))}
            <li>
              <a href={`mailto:${t('company.email')}`}>{t('company.email')}</a>
            </li>
            <li>{t('company.address')}</li>
          </ul>
        </section>
        <section aria-labelledby="footer-legal">
          <h2 id="footer-legal">{t('nav.rules')}</h2>
          <ul>
            <li>
              <Link href="/rules">{t('footer.offer')}</Link>
            </li>
            <li>
              <Link href="/attributions">{t('footer.attributions')}</Link>
            </li>
          </ul>
        </section>
      </div>
      <div className={styles.bottom}>
        <p>{t('footer.copyright')}</p>
      </div>
    </footer>
  );
}
