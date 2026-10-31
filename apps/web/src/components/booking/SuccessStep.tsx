'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  downloadTickets,
  getTicketSummary,
  type MockCompletion
} from '@/lib/api/booking';
import { ApiError } from '@/lib/api/client';
import { useErrorMessage } from '@/lib/api/hooks';
import { clearBooking, useBooking } from '@/lib/booking/storage';
import { formatDate, formatMoney } from '@/lib/format';
import { BookingSteps } from './BookingSteps';
import styles from './booking.module.css';

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function SuccessStep() {
  const t = useTranslations();
  const paid = useBooking('payment');

  if (paid === undefined) return <p>{t('common.loading')}</p>;
  if (paid === null) {
    return (
      <p role="alert">
        {t('payment.noCheckout')} <Link href="/">{t('session.restart')}</Link>
      </p>
    );
  }
  return <Ticket paid={paid} />;
}

function Ticket({ paid }: { paid: MockCompletion }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const payload = { data: paid.data, signature: paid.signature };

  const summary = useQuery({
    queryKey: ['ticket-summary', paid.data],
    queryFn: () => getTicketSummary(payload),
    // A LiqPay ticket may still be in the making; the mock one is immediate
    retry: (count, error) =>
      error instanceof ApiError && error.code === 'NOT_FOUND' && count < 3,
    retryDelay: 2000
  });
  const download = useMutation({
    mutationFn: () => downloadTickets(payload),
    onSuccess: ({ blob, fileName }) => saveFile(blob, fileName)
  });

  if (summary.isPending) return <p>{t('common.loading')}</p>;
  if (summary.isError) {
    return (
      <p role="alert" className="error">
        {summary.error instanceof ApiError && summary.error.code === 'NOT_FOUND'
          ? t('success.notReady')
          : errorMessage(summary.error)}
      </p>
    );
  }

  const ticket = summary.data;
  const date = (iso: string) => formatDate(iso, locale);
  return (
    <div className="narrow">
      <BookingSteps current="done" />
      <section className={`card card-raised ${styles.centered}`}>
        <span className={`${styles.statusIcon} ${styles.statusPositive}`}>
          <Check size={36} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <h1>{t('success.title')}</h1>
        <p>
          <span className="badge badge-large">
            {t('success.ticketNumber', { number: ticket.ticketNumber })}
          </span>
        </p>
        <dl className={styles.ticket}>
          <dt>{t('success.trip')}</dt>
          <dd>
            {ticket.origin.name} → {ticket.destination.name}
          </dd>
          <dt>{t('success.dates')}</dt>
          <dd>
            {date(ticket.dateOfDeparture)}
            {ticket.dateOfReturn && ` – ${date(ticket.dateOfReturn)}`}
          </dd>
          <dt>{t('success.passengers')}</dt>
          <dd>
            <ul>
              {ticket.passengers.map((p, index) => (
                <li key={index}>
                  {p.name} {p.lastName}
                </li>
              ))}
            </ul>
          </dd>
          <dt>{t('success.paid')}</dt>
          <dd>
            {formatMoney(
              ticket.amountPaid.amount,
              ticket.amountPaid.currency,
              locale
            )}
          </dd>
        </dl>
        {download.isError && (
          <p role="alert" className="error">
            {errorMessage(download.error)}
          </p>
        )}
        <div className="stack">
          <button
            type="button"
            className="button-block"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            <Download size={18} aria-hidden="true" />
            {download.isPending
              ? t('success.downloading')
              : t('success.download')}
          </button>
          <Link
            href="/"
            className="button button-outline button-block"
            onClick={() =>
              clearBooking('payment', 'offer', 'search', 'expiresAt')
            }
          >
            {t('success.bookAnother')}
          </Link>
        </div>
        <p className={`muted caption ${styles.afterActions}`}>
          {t('success.emailNote')}
        </p>
      </section>
    </div>
  );
}
