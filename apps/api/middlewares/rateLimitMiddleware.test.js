/** @format */

// Run with:  node --test middlewares/rateLimitMiddleware.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimitHandler } = require('@middlewares/rateLimitMiddleware');

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

test('answers 429 in the public error shape with a TOO_MANY_REQUESTS code', () => {
  const handler = createRateLimitHandler({ logSecurity() {} });
  const res = fakeResponse();

  handler({ ip: '203.0.113.7', path: '/api/network' }, res);

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later.',
    errors: []
  });
});

test('logs the client IP and path as a security event', () => {
  const events = [];
  const handler = createRateLimitHandler({
    logSecurity: (event, details) => events.push({ event, details })
  });

  handler({ ip: '203.0.113.7', path: '/api/network' }, fakeResponse());

  assert.deepEqual(events, [
    {
      event: 'Rate limit exceeded',
      details: { ip: '203.0.113.7', path: '/api/network' }
    }
  ]);
});
