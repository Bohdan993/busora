/** @format */

// Run with:  node --test services/ticketSummaryService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTicketSummary } = require('@services/ticketSummaryService');

const ticket = {
  ticketNumber: '#000042',
  language: { code: 'cs_CZ' },
  dateOfDeparture: '2026-11-07',
  dateOfReturn: null,
  originCity: { id: 8, cityattrs: [{ name: 'Praha' }] },
  destinationCity: { id: 1, cityattrs: [{ name: 'Kyjev' }] },
  price: '9268',
  currencyAbbr: 'UAH',
  priceUAH: '9268',
  passengertickets: [
    { passenger: { name: 'Jana', lastName: 'Novakova', type: 'adult' } },
    { passenger: { name: 'Eva', lastName: 'Novakova', type: 'child' } }
  ]
};

test('summarises a ticket in its booking language', () => {
  assert.deepEqual(buildTicketSummary(ticket), {
    ticketNumber: '#000042',
    languageCode: 'cs_CZ',
    dateOfDeparture: '2026-11-07',
    dateOfReturn: null,
    origin: { id: 8, name: 'Praha' },
    destination: { id: 1, name: 'Kyjev' },
    amountPaid: { amount: 9268, currency: 'UAH' },
    passengers: [
      { name: 'Jana', lastName: 'Novakova', type: 'adult' },
      { name: 'Eva', lastName: 'Novakova', type: 'child' }
    ]
  });
});

test('a legacy ticket without priceUAH reports its price as the amount paid', () => {
  const summary = buildTicketSummary({
    ...ticket,
    currencyAbbr: 'UAH',
    price: 3300,
    priceUAH: null,
    passengertickets: undefined
  });
  assert.deepEqual(summary.amountPaid, { amount: 3300, currency: 'UAH' });
  assert.deepEqual(summary.passengers, []);
});
