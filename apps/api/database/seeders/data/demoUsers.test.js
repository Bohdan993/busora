/** @format */

// Run with:  node --test database/seeders/data/demoUsers.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const { credentialsFor } = require('./demoUsers');

const ADMIN = { envPrefix: 'SEED_ADMIN' };
const env = (password) => ({
  SEED_ADMIN_EMAIL: 'admin@busora.test',
  SEED_ADMIN_PASSWORD: password
});

test('returns the credentials when the password fits the login form', () => {
  assert.deepEqual(credentialsFor(ADMIN, env('a'.repeat(32))), {
    email: 'admin@busora.test',
    password: 'a'.repeat(32)
  });
});

test('skips a user whose email or password is not set', () => {
  assert.equal(credentialsFor(ADMIN, {}), null);
});

test('rejects a password shorter than 8 characters', () => {
  assert.throws(() => credentialsFor(ADMIN, env('short')), /at least 8/);
});

// The admin login form and the API's login validation stop at 32 characters,
// so a longer seeded password could never be used
test('rejects a password longer than 32 characters', () => {
  assert.throws(() => credentialsFor(ADMIN, env('a'.repeat(33))), /at most 32/);
});
