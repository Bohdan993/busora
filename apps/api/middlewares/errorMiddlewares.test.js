/** @format */

// Run with:  node --test middlewares/errorMiddlewares.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { handleError } = require('@middlewares/errorMiddlewares');
const ExchangeRateError = require('@exeptions/exchange-rate-error');

function fakeResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    }
  };
  return res;
}

// handleError logs every error; keep test output clean.
test.beforeEach(() => test.mock.method(console, 'error', () => {}));
test.afterEach(() => test.mock.restoreAll());

test('maps ExchangeRateError to 503 without leaking the internal message', () => {
  const res = fakeResponse();
  handleError(new ExchangeRateError('NBU rate API responded 502'), {}, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, 'fail');
  assert.doesNotMatch(res.body.error, /NBU|502/);
});

test('unknown errors still map to 500', () => {
  const res = fakeResponse();
  handleError(new Error('boom'), {}, res);

  assert.equal(res.statusCode, 500);
});
