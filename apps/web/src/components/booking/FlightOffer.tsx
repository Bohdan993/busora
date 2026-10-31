'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { BusFlight } from '@/lib/api/booking';
import { formatDate, formatMoney } from '@/lib/format';
import styles from './booking.module.css';

type Leg = BusFlight['places']['from'];
/** Leg titles sit one level below the heading the offer is listed under */
export type LegHeading = 'h2' | 'h4';

function LegDetails({
  title,
  date,
  leg,
  heading: Heading
}: {
  title: string;
  date: string;
  leg: Leg;
  heading: LegHeading;
}) {
  const t = useTranslations('results');
  const locale = useLocale();
  return (
    <div className={styles.leg}>
      <Heading className={styles.legTitle}>
        {title}:{' '}
        {formatDate(date, locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })}
      </Heading>
      <dl className={styles.times}>
        <div>
          <dt>{t('departs')}</dt>
          <dd>
            <span className={styles.time}>{leg.onBoardingTime}</span>
            <span className={styles.place}>{leg.onBoardingPlace}</span>
          </dd>
        </div>
        <div>
          <dt>{t('arrives')}</dt>
          <dd>
            <span className={styles.time}>{leg.outBoardingTime}</span>
            <span className={styles.place}>{leg.outBoardingPlace}</span>
          </dd>
        </div>
      </dl>
      <p className={styles.routeName}>{leg.routeName}</p>
    </div>
  );
}

/** One bookable offer: outbound (and return) legs, price and a select button. */
export function FlightOffer({
  offer,
  currency,
  onSelect,
  busy,
  showReturn = true,
  legHeading
}: {
  offer: BusFlight;
  currency: string;
  onSelect: () => void;
  busy: boolean;
  showReturn?: boolean;
  legHeading: LegHeading;
}) {
  const t = useTranslations('results');
  const locale = useLocale();
  const hasReturn =
    showReturn &&
    offer.dates.returnPure &&
    /^\d{4}-/.test(offer.dates.returnPure);
  const percent = offer.discountPercentage ?? 0;
  const promo = percent > 0;

  return (
    <article className={styles.offer}>
      <div className={styles.legs}>
        <LegDetails
          title={t('outbound')}
          date={offer.dates.departurePure}
          leg={offer.places.from}
          heading={legHeading}
        />
        {hasReturn && (
          <LegDetails
            title={t('return')}
            date={offer.dates.returnPure!}
            leg={offer.places.to}
            heading={legHeading}
          />
        )}
      </div>
      <div className={styles.buy}>
        {promo && (
          <p className={styles.promo}>
            <span className="badge badge-highlight">
              {t('promo', { percent })}
            </span>
            <s className="muted">
              {formatMoney(Number(offer.purePriceFull), currency, locale)}
            </s>
          </p>
        )}
        <p className={styles.price}>
          {formatMoney(Number(offer.purePrice), currency, locale)}
        </p>
        <p className="muted caption">{t('pricePerPassenger')}</p>
        <button
          type="button"
          onClick={onSelect}
          disabled={busy}
          className="button-block"
        >
          {busy ? t('selecting') : t('select')}
        </button>
      </div>
    </article>
  );
}
