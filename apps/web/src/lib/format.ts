/** Whole-unit money, e.g. "3 300 ₴" / "1 590 Kč" in the page's locale. */
export function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0
  }).format(amount);
}

// 2026-01-04 was a Sunday: day N of the week is 4 + N January
const SUNDAY = Date.UTC(2026, 0, 4);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Localised weekday names, index 0 = Sunday. */
export function weekdayNames(
  locale: string,
  width: 'short' | 'long' = 'short'
): string[] {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: width,
    timeZone: 'UTC'
  });
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(SUNDAY + day * MS_PER_DAY))
  );
}

/** Monday-first order for showing weekdays (Europe). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "YYYY-MM-DD" of a date in UTC. */
export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

/** A calendar date ("YYYY-MM-DD") in the page's locale, e.g. "7 Nov 2026". */
export function formatDate(
  isoDate: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC'
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Hours and minutes of a duration, for "{hours} h {minutes} min" messages. */
export const splitMinutes = (total: number) => ({
  hours: Math.floor(total / 60),
  minutes: total % 60
});
