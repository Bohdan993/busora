/** @format */

// Run with:  node --test services/ticketService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  passengersInfoToArray,
  splitAmount
} = require('@services/ticketService');

test('splitAmount divides a total in proportion to the weights', () => {
  // 2 adults at 1590 Kč and a child at 1272 Kč (20 % off), charged 9268 UAH
  assert.deepEqual(splitAmount(9268, [1590, 1590, 1272]), [3310, 3310, 2648]);
});

test('splitAmount parts always sum exactly to the total', () => {
  for (const [total, weights] of [
    [10, [1, 1, 1]],
    [100, [3, 3, 3]],
    [9999, [1590, 1272, 1590, 795]],
    [7, [2, 1]]
  ]) {
    const parts = splitAmount(total, weights);
    assert.equal(
      parts.reduce((a, b) => a + b, 0),
      total,
      JSON.stringify(weights)
    );
    assert.ok(parts.every(Number.isInteger));
  }
});

test('splitAmount gives the rounding remainder to the largest fractions', () => {
  assert.deepEqual(splitAmount(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(splitAmount(7, [2, 1]), [5, 2]);
});

test('splitAmount splits evenly when weights are missing or zero', () => {
  assert.deepEqual(splitAmount(10, [null, undefined, 0]), [4, 3, 3]);
  assert.deepEqual(splitAmount(9, [5, null, 4]), [3, 3, 3]);
  assert.deepEqual(splitAmount(0, [1, 2]), [0, 0]);
});

test('passengersInfoToArray carries each passenger price as a split weight', () => {
  const weights = passengersInfoToArray({
    'adult-passenger-1': { 'discount-ticket-price-1': 1590 },
    'child-passenger-2': { 'discount-ticket-price-2': '1272' },
    'adult-passenger-3': {}
  }).map((p) => p.priceWeight);
  assert.deepEqual(weights, [1590, 1272, null]);
});

const dateOfBirthOf = (passengersInfo) =>
  passengersInfoToArray(passengersInfo).map((p) => [p.type, p.dateOfBirth]);

test('accepts ISO dates of birth for adults and children', () => {
  assert.deepEqual(
    dateOfBirthOf({
      'adult-passenger-1': {
        'name-1': 'Jana',
        'date-of-birth-1': '1985-03-20'
      },
      'child-passenger-2': { 'name-2': 'Eva', 'date-of-birth-2': '2019-05-05' }
    }),
    [
      ['adult', '1985-03-20'],
      ['child', '2019-05-05']
    ]
  );
});

test('still accepts epoch-millisecond dates of birth (old frontend)', () => {
  const ms = Date.UTC(2019, 4, 5);
  assert.deepEqual(
    dateOfBirthOf({
      'adult-passenger-1': { 'date-of-birth-1': Date.UTC(1985, 2, 20) },
      'child-passenger-2': { 'date-of-birth-2': ms },
      'child-passenger-3': { 'date-of-birth-3': String(ms) }
    }),
    [
      ['adult', '1985-03-20'],
      ['child', '2019-05-05'],
      ['child', '2019-05-05']
    ]
  );
});

test('a missing or unparseable date of birth becomes null instead of throwing', () => {
  assert.deepEqual(
    dateOfBirthOf({
      'adult-passenger-1': { 'name-1': 'Jana' },
      'child-passenger-2': { 'date-of-birth-2': 'not a date' }
    }),
    [
      ['adult', null],
      ['child', null]
    ]
  );
});
