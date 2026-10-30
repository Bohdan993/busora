/** @format */

// Run with:  node --test config/market.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HOME_CURRENCY,
  PHONE_PATTERN,
  getPaymentLanguage
} = require('./market');

test('home currency is UAH (the stored money truth)', () => {
  assert.equal(HOME_CURRENCY, 'UAH');
});

test('phone pattern accepts Ukrainian mobile numbers', () => {
  assert.match('+380671234567', PHONE_PATTERN);
  assert.match('+380501234567', PHONE_PATTERN);
});

test('phone pattern accepts Czech mobile numbers', () => {
  assert.match('+420601123456', PHONE_PATTERN);
  assert.match('+420777123456', PHONE_PATTERN);
});

test('phone pattern rejects German numbers (no longer a market)', () => {
  assert.doesNotMatch('+4915112345678', PHONE_PATTERN);
  assert.doesNotMatch('+491511234567', PHONE_PATTERN);
});

test('phone pattern rejects malformed numbers', () => {
  for (const phone of [
    '+38067123456', // one digit short
    '+3806712345678', // one digit long
    '+380121234567', // not a mobile operator code
    '+42060112345', // Czech, one digit short
    '+420201123456', // Czech landline
    '380671234567', // missing +
    '+380 67 123 45 67' // spaces
  ]) {
    assert.doesNotMatch(phone, PHONE_PATTERN, phone);
  }
});

test('payment language maps each locale and falls back to English', () => {
  assert.equal(getPaymentLanguage('uk_UA'), 'uk');
  assert.equal(getPaymentLanguage('cs_CZ'), 'en');
  assert.equal(getPaymentLanguage('en_US'), 'en');
  assert.equal(getPaymentLanguage('xx_XX'), 'en');
  assert.equal(getPaymentLanguage(undefined), 'en');
});
