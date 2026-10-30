/** @format */

/**
 * Decorator: remembers each currency's rate for ttlMs so searches don't call
 * the rate source on every request. Failures are never cached.
 * In-memory per process — the API runs as a single process.
 */
function createCachedRateProvider(provider, { ttlMs, now = Date.now }) {
  const cache = new Map();

  async function getRate(currencyAbbr) {
    const cached = cache.get(currencyAbbr);
    if (cached && now() < cached.expiresAt) return cached.rate;

    const rate = await provider.getRate(currencyAbbr);
    cache.set(currencyAbbr, { rate, expiresAt: now() + ttlMs });
    return rate;
  }

  return { getRate };
}

module.exports = { createCachedRateProvider };
