'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  getCurrentData,
  getPassengerForm,
  startCheckout
} from '@/lib/api/booking';
import { useApiLanguage, useErrorMessage } from '@/lib/api/hooks';
import { fromPassengersInfo } from '@/lib/booking/passengers';
import { useBooking, writeBooking } from '@/lib/booking/storage';
import { formatMoney } from '@/lib/format';
import { BookingSteps } from './BookingSteps';
import { SessionTimer } from './SessionTimer';
import { TripSummary } from './TripSummary';

export function ReviewStep() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const languageCode = useApiLanguage();
  const errorMessage = useErrorMessage();

  const current = useQuery({
    queryKey: ['current-data'],
    queryFn: getCurrentData,
    staleTime: 0,
    gcTime: 0
  });
  // The validated passengers, for showing their names
  const form = useQuery({
    queryKey: ['passenger-form', languageCode],
    queryFn: () => getPassengerForm(languageCode),
    staleTime: 0,
    gcTime: 0
  });

  const checkout = useMutation({
    mutationFn: () => startCheckout(languageCode),
    onSuccess: (data) => {
      writeBooking('checkout', data);
      router.push('/booking/payment');
    }
  });

  const currency = useBooking('search')?.currencyAbbr;
  const passengers = form.data?.passengersInfo
    ? fromPassengersInfo(form.data.passengersInfo)
    : [];

  return (
    <>
      <BookingSteps current="review" />
      <h1>{t('review.title')}</h1>
      <SessionTimer />
      <TripSummary />
      {current.isPending && <p>{t('common.loading')}</p>}
      {current.isError && (
        <p role="alert" className="error">
          {errorMessage(current.error)}{' '}
          <Link href="/">{t('session.restart')}</Link>
        </p>
      )}
      {current.isSuccess && (
        <>
          <section className="card">
            <h2>{t('review.passengers')}</h2>
            <ul>
              {passengers.map((p, index) => (
                <li key={index}>
                  {p.name} {p.lastName}
                </li>
              ))}
            </ul>
            <p>
              <Link href="/booking/passengers">{t('review.edit')}</Link>
            </p>
          </section>
          <p>
            {t('review.total')}:{' '}
            <strong>
              {currency
                ? formatMoney(current.data.price, currency, locale)
                : `${current.data.price} ${current.data.currencySymbol}`}
            </strong>
          </p>
          <p className="muted">{t('review.chargeNote')}</p>
          <p className="muted">
            {t('review.terms')} <Link href="/rules">{t('nav.rules')}</Link>
          </p>
          {checkout.isError && (
            <p role="alert" className="error">
              {errorMessage(checkout.error)}
            </p>
          )}
          <button
            type="button"
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? t('review.starting') : t('review.pay')}
          </button>
        </>
      )}
    </>
  );
}
