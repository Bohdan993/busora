'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useBooking } from '@/lib/booking/storage';
import { useNow } from '@/lib/useNow';

const pad = (n: number) => String(n).padStart(2, '0');

/** Time left on the booking session (the API cookie lives 15 minutes). */
export function SessionTimer() {
  const t = useTranslations('session');
  const expiresAt = useBooking('expiresAt');
  const now = useNow(1000);

  if (!expiresAt || now === null) return null;
  const seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
  if (seconds === 0) {
    return (
      <p role="alert" className="error">
        {t('expired')} <Link href="/">{t('restart')}</Link>
      </p>
    );
  }
  return (
    <p className="muted" aria-live="off">
      {t('remaining', {
        time: `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
      })}
    </p>
  );
}
