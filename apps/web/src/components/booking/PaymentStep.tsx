'use client';

import { useMutation } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { completeMockPayment } from '@/lib/api/booking';
import { useErrorMessage } from '@/lib/api/hooks';
import { clearBooking, useBooking, writeBooking } from '@/lib/booking/storage';
import { formatMoney } from '@/lib/format';
import { BookingSteps } from './BookingSteps';
import styles from './booking.module.css';

/** The simulated payment page of the mock provider. */
export function PaymentStep() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const checkout = useBooking('checkout');

  const pay = useMutation({
    mutationFn: (outcome: 'success' | 'failure') =>
      completeMockPayment(checkout!, outcome),
    onSuccess: (result) => {
      writeBooking('payment', result);
      clearBooking('checkout');
      router.push(
        result.outcome === 'success' ? '/booking/success' : '/booking/failed'
      );
    }
  });

  if (checkout === undefined) return <p>{t('common.loading')}</p>;
  if (checkout === null) {
    return (
      <p role="alert">
        {t('payment.noCheckout')} <Link href="/">{t('session.restart')}</Link>
      </p>
    );
  }
  if (checkout.provider !== 'mock') {
    return <p role="alert">{t('payment.unsupported')}</p>;
  }

  const amount = formatMoney(checkout.amount, checkout.currency, locale);
  return (
    <div className="narrow">
      <BookingSteps current="payment" />
      <section className={`card card-raised ${styles.centered}`}>
        <span className={`${styles.statusIcon} ${styles.statusAction}`}>
          <CreditCard size={32} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1>{t('payment.title')}</h1>
        <p className="notice">
          <span className="badge badge-highlight">{t('common.demoBadge')}</span>
          {t('payment.demoNote')}
        </p>
        <p className="muted">{t('payment.amount')}</p>
        <p className={styles.amount}>{amount}</p>
        {pay.isError && (
          <p role="alert" className="error">
            {errorMessage(pay.error)}
          </p>
        )}
        <div className="stack">
          <button
            type="button"
            className="button-block"
            onClick={() => pay.mutate('success')}
            disabled={pay.isPending}
          >
            {pay.isPending
              ? t('payment.processing')
              : t('payment.pay', { amount })}
          </button>
          <button
            type="button"
            className="button-outline button-block"
            onClick={() => pay.mutate('failure')}
            disabled={pay.isPending}
          >
            {t('payment.decline')}
          </button>
        </div>
      </section>
    </div>
  );
}
