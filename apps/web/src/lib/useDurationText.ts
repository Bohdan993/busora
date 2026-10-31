'use client';

import { useTranslations } from 'next-intl';
import { splitMinutes } from './format';

/** "26 h" or "19 h 30 min" in the page's language. */
export function useDurationText() {
  const t = useTranslations('common');
  return (totalMinutes: number) => {
    const { hours, minutes } = splitMinutes(totalMinutes);
    return minutes
      ? t('duration', { hours, minutes })
      : t('durationHours', { hours });
  };
}
