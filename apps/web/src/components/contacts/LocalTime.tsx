'use client';

import { useLocale, useTranslations } from 'next-intl';
import { OFFICE } from '@/content/company';
import { useNow } from '@/lib/useNow';

const MINUTE = 60_000;

/** The current time somewhere, to the minute. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const t = useTranslations('contactsPage');
  const locale = useLocale();
  const now = useNow(MINUTE);
  if (now === null) return null;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit'
  }).format(now);
  return <p className="muted">{t('localTime', { time })}</p>;
}

/** Weekday and hour in the office's time zone. */
function officeClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE.timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(now);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    parts.find((p) => p.type === 'weekday')?.value ?? ''
  );
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return { weekday, hour };
}

export function isOfficeOpen(now: Date) {
  const { weekday, hour } = officeClock(now);
  return (
    OFFICE.openDays.includes(weekday) &&
    hour >= OFFICE.opensAt &&
    hour < OFFICE.closesAt
  );
}

export function OfficeStatus() {
  const t = useTranslations('contactsPage');
  const now = useNow(MINUTE);
  if (now === null) return null;
  return <p>{isOfficeOpen(new Date(now)) ? t('open') : t('closed')}</p>;
}
