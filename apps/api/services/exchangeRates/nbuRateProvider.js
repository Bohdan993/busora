/** @format */

const nodeFetch = require('node-fetch');
const ExchangeRateError = require('@exeptions/exchange-rate-error');

// Official National Bank of Ukraine rates: UAH per 1 unit of a currency.
// Unlike PrivatBank's public feed (EUR/USD only) it covers CZK.
const NBU_EXCHANGE_URL =
  'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
const REQUEST_TIMEOUT_MS = 5000;

function createNbuRateProvider({ fetchFn = nodeFetch } = {}) {
  async function getRate(currencyAbbr) {
    const url = `${NBU_EXCHANGE_URL}?valcode=${encodeURIComponent(currencyAbbr)}&json`;

    let rows;
    try {
      const response = await fetchFn(url, { timeout: REQUEST_TIMEOUT_MS });
      if (!response.ok) {
        throw new ExchangeRateError(
          `NBU rate API responded ${response.status}`
        );
      }
      rows = await response.json();
    } catch (err) {
      if (err instanceof ExchangeRateError) throw err;
      throw new ExchangeRateError(
        `NBU rate request for ${currencyAbbr} failed`,
        {
          cause: err
        }
      );
    }

    const row = Array.isArray(rows)
      ? rows.find((el) => el?.cc === currencyAbbr)
      : null;
    const rate = Number(row?.rate);
    if (!row || row.rate === null || !Number.isFinite(rate) || rate <= 0) {
      throw new ExchangeRateError(`NBU has no valid rate for ${currencyAbbr}`);
    }
    return rate;
  }

  return { getRate };
}

module.exports = { createNbuRateProvider };
