import { describe, expect, it } from 'vitest';
import {
  cityPairs,
  departureWeekdays,
  destinationsFrom,
  findDirection,
  findFare,
  stopWeekdays,
  tripMinutes,
  type Network
} from './network';

// Line 1 as seeded: Kyiv (1) / Lviv (4) → Ostrava (10) / Praha (8) and back
const network: Network = {
  cities: [
    {
      id: 1,
      name: 'Kyiv',
      country: { id: 1, name: 'Ukraine' },
      currency: { abbr: 'UAH', symbol: '₴' }
    },
    {
      id: 4,
      name: 'Lviv',
      country: { id: 1, name: 'Ukraine' },
      currency: { abbr: 'UAH', symbol: '₴' }
    },
    {
      id: 8,
      name: 'Praha',
      country: { id: 2, name: 'Czechia' },
      currency: { abbr: 'CZK', symbol: 'Kč' }
    },
    {
      id: 10,
      name: 'Ostrava',
      country: { id: 2, name: 'Czechia' },
      currency: { abbr: 'CZK', symbol: 'Kč' }
    }
  ],
  lines: [
    {
      id: 1,
      directions: [
        {
          routeId: 1,
          name: 'Kyiv - Prague',
          countryId: 1,
          weekdays: [2, 4, 6],
          stops: [
            {
              kind: 'boarding',
              cityId: 1,
              placeId: 1,
              placeName: null,
              time: '07:00',
              dayOffset: 0
            },
            {
              kind: 'boarding',
              cityId: 4,
              placeId: 4,
              placeName: null,
              time: '15:30',
              dayOffset: 0
            },
            {
              kind: 'dropOff',
              cityId: 10,
              placeId: 10,
              placeName: null,
              time: '03:30',
              dayOffset: 1
            },
            {
              kind: 'dropOff',
              cityId: 8,
              placeId: 8,
              placeName: null,
              time: '09:00',
              dayOffset: 1
            }
          ]
        },
        {
          routeId: 2,
          name: 'Prague - Kyiv',
          countryId: 2,
          weekdays: [0, 3, 5],
          stops: [
            {
              kind: 'boarding',
              cityId: 8,
              placeId: 8,
              placeName: null,
              time: '17:00',
              dayOffset: 0
            },
            {
              kind: 'boarding',
              cityId: 10,
              placeId: 10,
              placeName: null,
              time: '22:30',
              dayOffset: 0
            },
            {
              kind: 'dropOff',
              cityId: 4,
              placeId: 4,
              placeName: null,
              time: '11:30',
              dayOffset: 1
            },
            {
              kind: 'dropOff',
              cityId: 1,
              placeId: 1,
              placeName: null,
              time: '20:00',
              dayOffset: 1
            }
          ]
        }
      ]
    }
  ],
  fares: [
    {
      fromCityId: 1,
      toCityId: 8,
      currency: 'UAH',
      oneWay: 3300,
      roundTrip: 5940
    },
    {
      fromCityId: 1,
      toCityId: 8,
      currency: 'CZK',
      oneWay: 1590,
      roundTrip: 2860
    },
    {
      fromCityId: 8,
      toCityId: 1,
      currency: 'CZK',
      oneWay: 1590,
      roundTrip: 2860
    }
  ]
};
const [outbound] = network.lines[0].directions;

describe('findDirection', () => {
  it('finds the direction that boards at the origin and drops off at the destination', () => {
    expect(findDirection(network, 4, 8)?.routeId).toBe(1);
    expect(findDirection(network, 8, 4)?.routeId).toBe(2);
  });

  it('does not travel against the direction of a route', () => {
    expect(findDirection(network, 1, 4)).toBeUndefined();
  });
});

describe('tripMinutes', () => {
  it('counts an overnight trip across midnight', () => {
    // Kyiv 07:00 → Praha 09:00 next day
    expect(tripMinutes(outbound, 1, 8)).toBe(26 * 60);
    // Lviv 15:30 → Ostrava 03:30 next day
    expect(tripMinutes(outbound, 4, 10)).toBe(12 * 60);
  });

  it('is undefined for stops the direction does not serve that way', () => {
    expect(tripMinutes(outbound, 8, 1)).toBeUndefined();
  });
});

describe('weekdays', () => {
  it('departure days at a boarding stop are the direction days', () => {
    expect(departureWeekdays(outbound, 4)).toEqual([2, 4, 6]);
  });

  it('arrival days shift by the days on the road and wrap past Saturday', () => {
    const praha = outbound.stops[3];
    expect(stopWeekdays(outbound, praha)).toEqual([0, 3, 5]);
  });
});

describe('fares and pairs', () => {
  it('looks up a fare by direction and currency', () => {
    expect(findFare(network, 1, 8, 'CZK')?.oneWay).toBe(1590);
    expect(findFare(network, 8, 1, 'UAH')).toBeUndefined();
  });

  it('lists only destinations with a fare from the origin', () => {
    expect(destinationsFrom(network, 1).map((c) => c.id)).toEqual([8]);
  });

  it('pairs every boarding stop with every drop-off stop, with the return direction', () => {
    const pairs = cityPairs(network);
    expect(pairs.map((p) => `${p.fromCityId}-${p.toCityId}`)).toEqual([
      '1-10',
      '1-8',
      '4-10',
      '4-8',
      '8-4',
      '8-1',
      '10-4',
      '10-1'
    ]);
    expect(pairs[1].inbound?.routeId).toBe(2);
  });
});
