'use client';

import { useLocale } from 'next-intl';
import { WEEK_ORDER, weekdayNames } from '@/lib/format';

/** Weekday numbers (0 = Sunday) as short names, Monday first. */
export function Weekdays({ days }: { days: number[] }) {
  const locale = useLocale();
  const names = weekdayNames(locale);
  const long = weekdayNames(locale, 'long');
  const ordered = WEEK_ORDER.filter((day) => days.includes(day));
  return (
    <span>
      {ordered.map((day, index) => (
        <abbr key={day} title={long[day]}>
          {names[day]}
          {index < ordered.length - 1 ? ' ' : ''}
        </abbr>
      ))}
    </span>
  );
}
