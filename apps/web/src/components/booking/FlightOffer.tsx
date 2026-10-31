'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { BusFlight } from '@/lib/api/booking';
import { formatDate, formatMoney } from '@/lib/format';

type Leg = BusFlight['places']['from'];

function LegDetails({
  title,
  date,
  leg
}: {
  title: string;
  date: string;
  leg: Leg;
}) {
  const t = useTranslations('results');
  const locale = useLocale();
  return (
    <div>
      <h4>
        {title}:{' '}
        {formatDate(date, locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })}
      </h4>
      <dl>
        <dt>{t('departs')}</dt>
        <dd>
          {leg.onBoardingTime} — {leg.onBoardingPlace}
        </dd>
        <dt>{t('arrives')}</dt>
        <dd>
          {leg.outBoardingTime} — {leg.outBoardingPlace}
        </dd>
      </dl>
      <p className="muted">{leg.routeName}</p>
    </div>
  );
}

/** One bookable offer: outbound (and return) legs, price and a select button. */
export function FlightOffer({
  offer,
  currency,
  onSelect,
  busy,
  showReturn = true
}: {
  offer: BusFlight;
  currency: string;
  onSelect: () => void;
  busy: boolean;
  showReturn?: boolean;
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
    <article className="card">
      <LegDetails
        title={t('outbound')}
        date={offer.dates.departurePure}
        leg={offer.places.from}
      />
      {hasReturn && (
        <LegDetails
          title={t('return')}
          date={offer.dates.returnPure!}
          leg={offer.places.to}
        />
      )}
      <p>
        {promo && (
          <>
            <s>{formatMoney(Number(offer.purePriceFull), currency, locale)}</s>{' '}
            <strong>{t('promo', { percent })}</strong>{' '}
          </>
        )}
        <strong>
          {formatMoney(Number(offer.purePrice), currency, locale)}
        </strong>{' '}
        {t('pricePerPassenger')}
      </p>
      <button type="button" onClick={onSelect} disabled={busy}>
        {busy ? t('selecting') : t('select')}
      </button>
    </article>
  );
}
