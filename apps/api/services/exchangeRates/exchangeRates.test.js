/** @format */

// Run with:  node --test services/exchangeRates/exchangeRates.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createExchangeRateService,
  createNbuRateProvider,
  createFixedRateProvider,
  createCachedRateProvider,
  parseFixedRates
} = require('@services/exchangeRates');
const ExchangeRateError = require('@exeptions/exchange-rate-error');

// A fake fetch that answers like the NBU API and records requested URLs.
function fakeFetch(body, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return { ok, status, json: async () => body };
  };
  return { fetchFn, calls };
}

const NBU_CZK = [
  {
    r030: 203,
    txt: 'Чеська крона',
    rate: 1.8312,
    cc: 'CZK',
    exchangedate: '31.10.2026'
  }
];

test('NBU provider returns the rate for the requested currency', async () => {
  const { fetchFn, calls } = fakeFetch(NBU_CZK);
  const provider = createNbuRateProvider({ fetchFn });

  assert.equal(await provider.getRate('CZK'), 1.8312);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /valcode=CZK/);
  assert.match(calls[0], /json/);
});

test('NBU provider throws when the currency is not in the response', async () => {
  const { fetchFn } = fakeFetch([]);
  const provider = createNbuRateProvider({ fetchFn });

  await assert.rejects(provider.getRate('XYZ'), ExchangeRateError);
});

test('NBU provider throws on a non-positive or non-numeric rate', async () => {
  for (const rate of [0, -1, 'abc', null]) {
    const { fetchFn } = fakeFetch([{ cc: 'CZK', rate }]);
    const provider = createNbuRateProvider({ fetchFn });
    await assert.rejects(
      provider.getRate('CZK'),
      ExchangeRateError,
      String(rate)
    );
  }
});

test('NBU provider throws on an HTTP error', async () => {
  const { fetchFn } = fakeFetch(null, { ok: false, status: 503 });
  const provider = createNbuRateProvider({ fetchFn });

  await assert.rejects(provider.getRate('CZK'), ExchangeRateError);
});

test('NBU provider wraps network failures, keeping the cause', async () => {
  const networkError = new Error('ECONNRESET');
  const provider = createNbuRateProvider({
    fetchFn: async () => {
      throw networkError;
    }
  });

  await assert.rejects(provider.getRate('CZK'), (err) => {
    assert.ok(err instanceof ExchangeRateError);
    assert.equal(err.cause, networkError);
    return true;
  });
});

test('fixed provider returns configured rates and throws for unknown ones', async () => {
  const provider = createFixedRateProvider({ CZK: 1.8 });

  assert.equal(await provider.getRate('CZK'), 1.8);
  await assert.rejects(provider.getRate('EUR'), ExchangeRateError);
});

test('parseFixedRates reads "CZK=1.8,EUR=45" and rejects bad entries', () => {
  assert.deepEqual(parseFixedRates('CZK=1.8, EUR=45'), { CZK: 1.8, EUR: 45 });
  assert.throws(() => parseFixedRates('CZK=abc'), /FIXED_EXCHANGE_RATES/);
  assert.throws(() => parseFixedRates('CZK'), /FIXED_EXCHANGE_RATES/);
  assert.throws(() => parseFixedRates(''), /FIXED_EXCHANGE_RATES/);
});

test('cached provider reuses a rate until the TTL expires', async () => {
  let fetches = 0;
  const inner = {
    getRate: async () => {
      fetches += 1;
      return 1.8 + fetches / 100;
    }
  };
  let nowMs = 0;
  const provider = createCachedRateProvider(inner, {
    ttlMs: 1000,
    now: () => nowMs
  });

  assert.equal(await provider.getRate('CZK'), 1.81);
  nowMs = 999;
  assert.equal(await provider.getRate('CZK'), 1.81, 'cache hit before expiry');
  assert.equal(fetches, 1);

  nowMs = 1000;
  assert.equal(await provider.getRate('CZK'), 1.82, 'refetch at expiry');
  assert.equal(fetches, 2);
});

test('cached provider caches per currency and never caches failures', async () => {
  let fail = true;
  const inner = {
    getRate: async (abbr) => {
      if (fail) throw new ExchangeRateError(`no ${abbr}`);
      return abbr === 'CZK' ? 1.8 : 45;
    }
  };
  const provider = createCachedRateProvider(inner, {
    ttlMs: 1000,
    now: () => 0
  });

  await assert.rejects(provider.getRate('CZK'), ExchangeRateError);
  fail = false;
  assert.equal(await provider.getRate('CZK'), 1.8);
  assert.equal(await provider.getRate('EUR'), 45);
});

test('service returns 1 for the home currency without asking the provider', async () => {
  const service = createExchangeRateService({
    getRate: async () => assert.fail('provider must not be called for UAH')
  });

  assert.equal(await service.getRate('UAH'), 1);
});

test('service delegates other currencies and rejects a missing currency', async () => {
  const service = createExchangeRateService(
    createFixedRateProvider({ CZK: 1.8 })
  );

  assert.equal(await service.getRate('CZK'), 1.8);
  await assert.rejects(service.getRate(undefined), ExchangeRateError);
  await assert.rejects(service.getRate(''), ExchangeRateError);
});
