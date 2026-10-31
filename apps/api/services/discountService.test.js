/** @format */

// Run with:  node --test services/discountService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapDiscounts,
  toPassengerFormDiscounts
} = require('@services/discountService');

const child = {
  id: 3,
  coef: '0.2',
  group: 'children',
  minAge: null,
  maxAge: 11,
  inactivePeriod: null,
  discountattrs: [{ name: 'Child 5–11', languageId: 3 }]
};
const student = {
  id: 7,
  coef: 0.15,
  group: 'adults',
  minAge: 16,
  maxAge: 26,
  discountattrs: [{ name: 'Student', languageId: 3 }]
};

test('toPassengerFormDiscounts gives one object per group with flat items', () => {
  assert.deepEqual(toPassengerFormDiscounts(mapDiscounts([child, student])), [
    {
      group: 'children',
      items: [
        { id: 3, name: 'Child 5–11', coef: 0.2, minAge: null, maxAge: 11 }
      ]
    },
    {
      group: 'adults',
      items: [{ id: 7, name: 'Student', coef: 0.15, minAge: 16, maxAge: 26 }]
    }
  ]);
});

test('toPassengerFormDiscounts tolerates a discount without a name', () => {
  const [{ items }] = toPassengerFormDiscounts([
    ['both', [{ id: 9, coef: 0.1 }]]
  ]);
  assert.deepEqual(items, [
    { id: 9, name: null, coef: 0.1, minAge: null, maxAge: null }
  ]);
});
