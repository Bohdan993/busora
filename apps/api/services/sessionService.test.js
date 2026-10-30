/** @format */

// Run with:  node --test services/sessionService.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyClientSessionUpdate } = require('@services/sessionService');
const APIError = require('@exeptions/api-error');

test('stores client UI state (bookingPageParams), HTML-encoded', () => {
  const session = {};
  applyClientSessionUpdate(session, { bookingPageParams: '<b>x</b>' });

  assert.equal(session.bookingPageParams, '&#60;b&#62;x&#60;/b&#62;');
});

test('rejects a non-string value with a 400 instead of crashing', () => {
  assert.throws(
    () => applyClientSessionUpdate({}, { bookingPageParams: { a: 1 } }),
    (err) => err instanceof APIError && err.status === 400
  );
});

test('rejects server-owned keys and leaves the session untouched', () => {
  for (const key of [
    'currencyExchangeRate',
    'passengersInfo',
    'selectedBusFlight',
    'currency',
    'email',
    'isStarted',
    '__proto__'
  ]) {
    const session = { currencyExchangeRate: 2.08 };
    const body = JSON.parse(`{"${key}": 0.01}`);
    assert.throws(
      () => applyClientSessionUpdate(session, body),
      (err) => err instanceof APIError && err.status === 400,
      key
    );
    assert.deepEqual(session, { currencyExchangeRate: 2.08 }, key);
  }
});

test('rejects a mixed body without applying the allowed part', () => {
  const session = {};
  assert.throws(() =>
    applyClientSessionUpdate(session, {
      bookingPageParams: 'ok',
      currencyExchangeRate: 0.01
    })
  );
  assert.deepEqual(session, {});
});
