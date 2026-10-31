import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, splitMinutes, weekdayNames } from './format';

describe('formatMoney', () => {
  it('shows whole units with the narrow currency symbol', () => {
    expect(formatMoney(1590, 'CZK', 'cs')).toMatch(/^1\s590\sKč$/);
    expect(formatMoney(3300, 'UAH', 'uk')).toMatch(/^3\s300\s₴$/);
  });
});

describe('weekdayNames', () => {
  it('starts on Sunday', () => {
    expect(weekdayNames('en')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat'
    ]);
    expect(weekdayNames('en', 'long')[1]).toBe('Monday');
  });
});

describe('formatDate', () => {
  it('formats a calendar date without shifting it by the time zone', () => {
    expect(formatDate('2026-11-07', 'en')).toBe('Nov 7, 2026');
  });
});

describe('splitMinutes', () => {
  it('splits a duration into hours and minutes', () => {
    expect(splitMinutes(26 * 60 + 30)).toEqual({ hours: 26, minutes: 30 });
  });
});
