/** @format */

// Run with:  node --test services/networkService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildNetwork } = require('@services/networkService');

const cities = [
  {
    id: 8,
    countryId: 2,
    cityattrs: [{ name: 'Praha' }],
    country: { id: 2, countryattrs: [{ name: 'Česko' }] },
    currency: { abbr: 'CZK', symbol: 'Kč' },
    places: [{ id: 8, placeattrs: [{ name: 'ÚAN Florenc' }] }]
  },
  {
    id: 1,
    countryId: 1,
    cityattrs: [{ name: 'Kyjev' }],
    country: { id: 1, countryattrs: [{ name: 'Ukrajina' }] },
    currency: { abbr: 'UAH', symbol: '₴' },
    places: [{ id: 1, placeattrs: [] }]
  }
];

const route = (id, countryId, onboarding, outboarding) => ({
  id,
  countryId,
  routeattrs: [{ name: `route ${id}` }],
  routePath: { routeGroupId: 1, onboarding, outboarding }
});

const routes = [
  // Stored as a JSON string by some drivers: both forms must work
  {
    ...route(2, 2, [{ cityId: 8, placeId: 8, time: '17:00' }], []),
    routePath: JSON.stringify({
      routeGroupId: 1,
      onboarding: [{ cityId: 8, placeId: 8, time: '17:00' }],
      outboarding: [{ cityId: 1, placeId: 1, time: '20:00' }]
    })
  },
  // Kyiv 07:00 → Lviv 15:30 → (overnight) Praha 09:00 the next day
  route(
    1,
    1,
    [
      { cityId: 1, placeId: 1, time: '07:00' },
      { cityId: 4, placeId: 4, time: '15:30' }
    ],
    [{ cityId: 8, placeId: 8, time: '09:00' }]
  )
];

const network = buildNetwork({
  routes,
  cities,
  prices: [
    {
      firstCityId: 8,
      secondCityId: 1,
      priceOneWay: 1590,
      priceRoundTrip: '2860',
      currency: { abbr: 'CZK' }
    },
    {
      firstCityId: 1,
      secondCityId: 8,
      priceOneWay: 3300,
      priceRoundTrip: 5940,
      currency: { abbr: 'UAH' }
    }
  ],
  weekdays: [
    { routeId: 1, weekday: 6 },
    { routeId: 1, weekday: 2 },
    { routeId: 2, weekday: '0' }
  ]
});

test('groups both directions of a line in route order', () => {
  assert.equal(network.lines.length, 1);
  assert.deepEqual(
    network.lines[0].directions.map((d) => [d.routeId, d.name, d.countryId]),
    [
      [1, 'route 1', 1],
      [2, 'route 2', 2]
    ]
  );
});

test('stops carry place names and the day each one is reached', () => {
  const [outbound] = network.lines[0].directions;
  assert.deepEqual(outbound.stops, [
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
      cityId: 8,
      placeId: 8,
      placeName: 'ÚAN Florenc',
      time: '09:00',
      dayOffset: 1
    }
  ]);
});

test('a later time on the same day keeps the day offset', () => {
  const inbound = network.lines[0].directions[1];
  assert.deepEqual(
    inbound.stops.map((s) => [s.time, s.dayOffset]),
    [
      ['17:00', 0],
      ['20:00', 0]
    ]
  );
});

test('weekdays come sorted as numbers, empty when a route has no flights', () => {
  const [outbound, inbound] = network.lines[0].directions;
  assert.deepEqual(outbound.weekdays, [2, 6]);
  assert.deepEqual(inbound.weekdays, [0]);
  const idle = buildNetwork({
    routes: [routes[1]],
    cities,
    prices: [],
    weekdays: []
  });
  assert.deepEqual(idle.lines[0].directions[0].weekdays, []);
});

test('cities and fares are flattened and sorted', () => {
  assert.deepEqual(network.cities, [
    {
      id: 1,
      name: 'Kyjev',
      country: { id: 1, name: 'Ukrajina' },
      currency: { abbr: 'UAH', symbol: '₴' }
    },
    {
      id: 8,
      name: 'Praha',
      country: { id: 2, name: 'Česko' },
      currency: { abbr: 'CZK', symbol: 'Kč' }
    }
  ]);
  assert.deepEqual(network.fares, [
    {
      fromCityId: 1,
      toCityId: 8,
      currency: 'UAH',
      oneWay: 3300,
      roundTrip: 5940
    },
    {
      fromCityId: 8,
      toCityId: 1,
      currency: 'CZK',
      oneWay: 1590,
      roundTrip: 2860
    }
  ]);
});
