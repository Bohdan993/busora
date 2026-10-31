'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useBooking } from '@/lib/booking/storage';
import { formatDate } from '@/lib/format';

/** The selected trip, as remembered from the results page. */
export function TripSummary() {
  const t = useTranslations('results');
  const locale = useLocale();
  const offer = useBooking('offer');

  if (!offer) return null;
  const date = (iso: string) =>
    formatDate(iso, locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  const hasReturn = /^\d{4}-/.test(offer.dates.returnPure ?? '');

  return (
    <section className="card">
      <h2>
        {offer.cities.from.name} → {offer.cities.to.name}
      </h2>
      <p>
        {t('outbound')}: {date(offer.dates.departurePure)},{' '}
        {offer.places.from.onBoardingTime} {offer.places.from.onBoardingPlace}
      </p>
      {hasReturn && (
        <p>
          {t('return')}: {date(offer.dates.returnPure!)},{' '}
          {offer.places.to.onBoardingTime} {offer.places.to.onBoardingPlace}
        </p>
      )}
    </section>
  );
}
