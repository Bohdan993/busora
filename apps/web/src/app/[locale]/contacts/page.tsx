import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { LocalTime, OfficeStatus } from '@/components/contacts/LocalTime';
import { OFFICE, PHONES_CZ, PHONES_UA, tel } from '@/content/company';
import { Phone } from 'lucide-react';
import styles from './contacts.module.css';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: 'contactsPage'
  });
  return { title: t('title') };
}

const PhoneList = ({ phones }: { phones: string[] }) => (
  <ul className={styles.phones}>
    {phones.map((phone) => (
      <li key={phone}>
        <a href={tel(phone)}>
          <Phone size={18} aria-hidden="true" />
          {phone}
        </a>
      </li>
    ))}
  </ul>
);

export default async function ContactsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations();

  return (
    <>
      <div className="page-head">
        <h1>{t('contactsPage.title')}</h1>
        <p className="lead muted">{t('contactsPage.note')}</p>
      </div>
      <div className={styles.cards}>
        <section className={`card card-raised ${styles.card}`}>
          <h2>{t('contactsPage.phonesUa')}</h2>
          <LocalTime timeZone="Europe/Kyiv" />
          <PhoneList phones={PHONES_UA} />
        </section>
        <section className={`card card-raised ${styles.card}`}>
          <h2>{t('contactsPage.phonesCz')}</h2>
          <LocalTime timeZone="Europe/Prague" />
          <PhoneList phones={PHONES_CZ} />
        </section>
        <section className={`card card-raised ${styles.card}`}>
          <h2>{t('contactsPage.office')}</h2>
          <OfficeStatus />
          <dl className={styles.details}>
            <dt>{t('contactsPage.address')}</dt>
            <dd>
              {t('company.name')}
              <br />
              {t('company.address')}
            </dd>
            <dt>{t('contactsPage.hours')}</dt>
            <dd>{t('company.hours')}</dd>
            <dt>{t('contactsPage.email')}</dt>
            <dd>
              <a href={`mailto:${t('company.email')}`}>{t('company.email')}</a>
            </dd>
          </dl>
          <LocalTime timeZone={OFFICE.timeZone} />
        </section>
      </div>
    </>
  );
}
