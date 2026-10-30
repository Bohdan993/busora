/** @format */

// Run with:  node --test middlewares/languageMiddleware.test.js

require('module-alias/register');

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateLanguageCode } = require('@middlewares/languageMiddleware');
const APIError = require('@exeptions/api-error');

function run(query) {
  let passed;
  validateLanguageCode({ query }, {}, (err) => {
    passed = err;
  });
  return passed;
}

test('passes requests without a languageCode', () => {
  assert.equal(run({}), undefined);
});

test('passes supported language codes', () => {
  for (const languageCode of ['uk_UA', 'cs_CZ', 'en_US']) {
    assert.equal(run({ languageCode }), undefined, languageCode);
  }
});

test('rejects unsupported codes and path traversal with a 400', () => {
  for (const languageCode of ['de_DE', '../../etc', 'uk_UA/..', ['uk_UA']]) {
    const err = run({ languageCode });
    assert.ok(err instanceof APIError, String(languageCode));
    assert.equal(err.status, 400);
  }
});
