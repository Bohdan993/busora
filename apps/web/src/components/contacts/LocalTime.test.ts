import { describe, expect, it } from 'vitest';
import { isOfficeOpen } from './LocalTime';

// Kyiv is UTC+2 in winter (EET)
describe('isOfficeOpen', () => {
  it('is open on a weekday within office hours in Kyiv', () => {
    // Tue 4 Nov 2026, 10:30 in Kyiv
    expect(isOfficeOpen(new Date('2026-11-03T08:30:00Z'))).toBe(true);
  });

  it('is closed after 18:00 Kyiv time even when it is earlier in UTC', () => {
    // 18:30 in Kyiv = 16:30 UTC
    expect(isOfficeOpen(new Date('2026-11-03T16:30:00Z'))).toBe(false);
  });

  it('is closed at weekends', () => {
    // Sat 7 Nov 2026, 12:00 in Kyiv
    expect(isOfficeOpen(new Date('2026-11-07T10:00:00Z'))).toBe(false);
  });
});
