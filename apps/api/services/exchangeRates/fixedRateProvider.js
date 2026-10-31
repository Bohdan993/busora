/** @format */

const ExchangeRateError = require('@exeptions/exchange-rate-error');

// Static rates for tests and offline development.
function createFixedRateProvider(rates) {
  async function getRate(currencyAbbr) {
    const rate = rates[currencyAbbr];
    if (rate === undefined) {
      throw new ExchangeRateError(
        `No fixed rate configured for ${currencyAbbr}`
      );
    }
    return rate;
  }

  return { getRate };
}

/**
 * Parses FIXED_EXCHANGE_RATES, e.g. "CZK=1.8,EUR=45" → { CZK: 1.8, EUR: 45 }.
 * Throws on anything malformed so a bad config fails at startup.
 */
function parseFixedRates(value) {
  const entries = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error('FIXED_EXCHANGE_RATES is empty (expected e.g. "CZK=1.8")');
  }

  return Object.fromEntries(
    entries.map((entry) => {
      const [currencyAbbr, rawRate] = entry.split('=');
      const rate = Number(rawRate);
      if (!currencyAbbr || !(rate > 0)) {
        throw new Error(`FIXED_EXCHANGE_RATES has a bad entry: "${entry}"`);
      }
      return [currencyAbbr.trim(), rate];
    })
  );
}

module.exports = { createFixedRateProvider, parseFixedRates };
