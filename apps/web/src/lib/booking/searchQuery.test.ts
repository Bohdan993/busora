import { describe, expect, it } from 'vitest';
import {
  endDateFor,
  parseSearchQuery,
  toSearchParams,
  tripTypeOf
} from './searchQuery';

const query = {
  originId: 8,
  destinationId: 1,
  startDate: '2026-11-04',
  endDate: '2026-11-14',
  adults: 2,
  children: 1,
  currencyAbbr: 'CZK'
};

describe('search query', () => {
  it('round-trips through URL parameters', () => {
    expect(parseSearchQuery(toSearchParams(query))).toEqual(query);
  });

  it('maps trip types to the API end date and back', () => {
    expect(endDateFor('oneWay')).toBe('one-way');
    expect(endDateFor('openDate')).toBe('open-date');
    expect(endDateFor('round', '2026-11-14')).toBe('2026-11-14');
    expect(tripTypeOf('one-way')).toBe('oneWay');
    expect(tripTypeOf('open-date')).toBe('openDate');
    expect(tripTypeOf('2026-11-14')).toBe('round');
  });

  it.each([
    ['same origin and destination', { destinationId: 8 }],
    ['a return before the departure', { endDate: '2026-11-01' }],
    ['no adult', { adults: 0 }],
    ['too many passengers', { adults: 9, children: 1 }],
    ['a malformed date', { startDate: '04.11.2026' }],
    ['an unknown end date keyword', { endDate: 'tomorrow' }],
    ['a non-numeric id', { originId: 'praha' }],
    ['a missing currency', { currencyAbbr: '' }]
  ])('rejects %s', (_, change) => {
    const params = toSearchParams(query);
    for (const [key, value] of Object.entries(change)) {
      params.set(key, String(value));
    }
    expect(parseSearchQuery(params)).toBeNull();
  });
});
