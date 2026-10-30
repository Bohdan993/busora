/** @format */

const { HOME_CURRENCY } = require('@root/config/market');
const ExchangeRateError = require('@exeptions/exchange-rate-error');
const { createNbuRateProvider } = require('./nbuRateProvider');
const {
  createFixedRateProvider,
  parseFixedRates
} = require('./fixedRateProvider');
const { createCachedRateProvider } = require('./cachedRateProvider');

// NBU publishes once per business day; an hour keeps rates fresh enough.
const RATE_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Converts a currency to UAH-per-unit. The home currency is always 1; every
 * other currency must come from the provider — a missing rate throws
 * ExchangeRateError rather than silently defaulting to 1.
 */
function createExchangeRateService(provider) {
  async function getRate(currencyAbbr) {
    if (!currencyAbbr) {
      throw new ExchangeRateError('Currency is required for an exchange rate');
    }
    if (currencyAbbr === HOME_CURRENCY) return 1;
    return provider.getRate(currencyAbbr);
  }

  return { getRate };
}

// EXCHANGE_RATE_PROVIDER: "nbu" (default, live rates) or "fixed" (offline
// development; rates from FIXED_EXCHANGE_RATES). Invalid config fails at startup.
function createConfiguredProvider(env) {
  const source = env.EXCHANGE_RATE_PROVIDER || 'nbu';
  if (source === 'nbu') {
    return createCachedRateProvider(createNbuRateProvider(), {
      ttlMs: RATE_CACHE_TTL_MS
    });
  }
  if (source === 'fixed') {
    return createFixedRateProvider(parseFixedRates(env.FIXED_EXCHANGE_RATES));
  }
  throw new Error(
    `EXCHANGE_RATE_PROVIDER must be "nbu" or "fixed", got "${source}"`
  );
}

const exchangeRates = createExchangeRateService(
  createConfiguredProvider(process.env)
);

module.exports = {
  getExchangeRate: (currencyAbbr) => exchangeRates.getRate(currencyAbbr),
  createExchangeRateService,
  createNbuRateProvider,
  createFixedRateProvider,
  createCachedRateProvider,
  parseFixedRates
};
