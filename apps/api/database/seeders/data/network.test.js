/** @format */

// Invariants of the seeded network that search, pricing and PDFs rely on.
// Run with:  node --test database/seeders/data/network.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COUNTRIES,
  CITIES,
  LINES,
  AGENTS,
  PASSENGER_DISCOUNTS,
  PROMO_DISCOUNT,
  SCHEDULE_DAYS
} = require('./network');
const {
  localizedRows,
  routeRows,
  routeCityOrderRows,
  priceRows,
  flightRows
} = require('./buildRows');

const NAME_COLUMN_LENGTH = 30; // cityattributes / countryattributes / agentattributes
const cityIdsOf = (stops) => stops.map(([cityId]) => cityId);
const directionsOf = (line) => [line.outbound, line.inbound];

test('every city, place, country, route, discount and agent is named in all locales', () => {
  const named = [
    ...COUNTRIES.map((c) => ['countryId', c.id, c.names]),
    ...CITIES.map((c) => ['cityId', c.id, c.names]),
    ...CITIES.map((c) => ['placeId', c.id, c.place]),
    ...LINES.flatMap(directionsOf).map((d) => ['routeId', d.routeId, d.names]),
    ...PASSENGER_DISCOUNTS.map((d) => ['discountId', d.id, d.names]),
    ['discountId', 0, PROMO_DISCOUNT.names],
    ...AGENTS.map((a) => ['agentId', a.id, a.names])
  ];
  for (const [key, id, names] of named) {
    assert.equal(localizedRows(key, id, names).length, 3, `${key} ${id}`);
  }
});

test('short names fit their 30-character columns', () => {
  for (const { names } of [...CITIES, ...COUNTRIES, ...AGENTS]) {
    for (const name of Object.values(names)) {
      assert.ok(name.length <= NAME_COLUMN_LENGTH, name);
    }
  }
});

test('lines run Ukraine → Czechia outbound and mirror the stops inbound', () => {
  const countryOf = (id) => CITIES.find((c) => c.id === id).countryId;
  for (const { outbound, inbound } of LINES) {
    assert.ok(cityIdsOf(outbound.boarding).every((id) => countryOf(id) === 1));
    assert.ok(cityIdsOf(outbound.dropOff).every((id) => countryOf(id) === 2));
    assert.deepEqual(
      [...cityIdsOf(inbound.boarding)].sort(),
      [...cityIdsOf(outbound.dropOff)].sort()
    );
    assert.deepEqual(
      [...cityIdsOf(inbound.dropOff)].sort(),
      [...cityIdsOf(outbound.boarding)].sort()
    );
  }
});

test('no city pair is served by two lines (search would be ambiguous)', () => {
  const pairsOf = (line) =>
    cityIdsOf(line.outbound.boarding).flatMap((ua) =>
      cityIdsOf(line.outbound.dropOff).map((cz) => `${ua}-${cz}`)
    );
  const all = LINES.flatMap(pairsOf);
  assert.equal(new Set(all).size, all.length);
});

test('routes start in the country of their first boarding city, one each way per group', () => {
  const rows = routeRows();
  assert.equal(rows.length, 4);
  for (const line of LINES) {
    const group = rows.filter(
      (r) => JSON.parse(r.routePath).routeGroupId === line.routeGroupId
    );
    assert.deepEqual(group.map((r) => r.countryId).sort(), [1, 2]);
  }
  const path = JSON.parse(rows[0].routePath);
  assert.deepEqual(path.onboarding[0], { cityId: 1, placeId: 1, time: '07:00' });
});

test('every bookable pair has a fare both ways in UAH and CZK', () => {
  const rows = priceRows();
  const key = (r) => `${r.firstCityId}-${r.secondCityId}-${r.currencyId}`;
  const keys = new Set(rows.map(key));
  assert.equal(keys.size, rows.length, 'no duplicate fare rows');

  for (const direction of LINES.flatMap(directionsOf)) {
    for (const origin of cityIdsOf(direction.boarding)) {
      for (const destination of cityIdsOf(direction.dropOff)) {
        for (const currencyId of [1, 2]) {
          assert.ok(keys.has(`${origin}-${destination}-${currencyId}`));
          assert.ok(keys.has(`${destination}-${origin}-${currencyId}`));
        }
      }
    }
  }
});

test('fares are rounded, positive, and a round trip costs more than one way', () => {
  for (const row of priceRows()) {
    assert.equal(row.priceOneWay % 10, 0);
    assert.equal(row.priceRoundTrip % 10, 0);
    assert.ok(row.priceOneWay > 0);
    assert.ok(row.priceRoundTrip > row.priceOneWay);
  }
  const kyivPraha = priceRows().filter(
    (r) => r.firstCityId === 1 && r.secondCityId === 8
  );
  assert.deepEqual(
    kyivPraha.map((r) => [r.currencyId, r.priceOneWay]),
    [
      [1, 3300],
      [2, 1590]
    ]
  );
});

test('route keys are admin-sortable codes and positions run 1..n', () => {
  const rows = routeCityOrderRows();
  for (const routeKey of new Set(rows.map((r) => r.routeKey))) {
    assert.match(routeKey, /^[A-Z]{1,8}$/);
    const positions = rows
      .filter((r) => r.routeKey === routeKey)
      .map((r) => r.position);
    assert.deepEqual(
      positions,
      positions.map((_, i) => i + 1)
    );
  }
});

test('flights run daily on every route from the start date', () => {
  const rows = flightRows(new Date('2026-11-01T22:30:00Z'));
  assert.equal(rows.length, SCHEDULE_DAYS * 4);
  assert.equal(rows[0].dateOfDeparture, '2026-11-01');
  assert.equal(rows[rows.length - 1].dateOfDeparture, '2027-01-29');
  assert.deepEqual(
    rows.slice(0, 4).map((r) => r.routeId),
    [1, 2, 3, 4]
  );
  assert.ok(rows.every((r) => r.freeSeats === r.allSeats && r.allSeats > 0));
});
