/** @format */

// Run with:  node --test middlewares/errorMiddlewares.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { handleError } = require('@middlewares/errorMiddlewares');
const ExchangeRateError = require('@exeptions/exchange-rate-error');
const APIError = require('@exeptions/api-error');

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
  assert.equal(res.body.code, 'EXCHANGE_RATE_UNAVAILABLE');
  assert.doesNotMatch(res.body.message, /NBU|502/);
});

test('unknown errors map to 500 without leaking their message', () => {
  const res = fakeResponse();
  handleError(new Error("ER_PARSE_ERROR near 'tickets'"), {}, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'SERVER_ERROR');
  assert.doesNotMatch(JSON.stringify(res.body), /ER_PARSE_ERROR|tickets/);
});

test('an APIError is answered with its status, code and field errors', () => {
  const res = fakeResponse();
  const fieldErrors = [{ field: 'name-1', message: 'Required' }];
  handleError(
    APIError.ValidationError('validation error', fieldErrors),
    {},
    res
  );

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    status: 'fail',
    code: 'VALIDATION_FAILED',
    message: 'validation error',
    errors: fieldErrors
  });
});

test('domain errors carry their specific code', () => {
  const res = fakeResponse();
  handleError(
    APIError.UnauthorizedError(
      'session expired',
      APIError.codes.SESSION_NOT_STARTED
    ),
    {},
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'SESSION_NOT_STARTED');
});
