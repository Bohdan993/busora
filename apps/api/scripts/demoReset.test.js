/** @format */

// Run with:  node --test scripts/demoReset.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const { msUntilNextRun, assertResetAllowed } = require('./demoReset');

const HOUR = 60 * 60 * 1000;
const at = (iso) => new Date(iso);
const KYIV = { hour: 3, timeZone: 'Europe/Kyiv' };

// Kyiv is UTC+2 in winter, so 03:00 Kyiv = 01:00 UTC
test('waits until 03:00 Kyiv later the same night', () => {
  assert.equal(msUntilNextRun(at('2026-11-10T00:00:00Z'), KYIV), HOUR);
});

test('waits a full day when it is exactly the run time', () => {
  assert.equal(msUntilNextRun(at('2026-11-10T01:00:00Z'), KYIV), 24 * HOUR);
});

test('rolls over to the next night after the run time', () => {
  assert.equal(msUntilNextRun(at('2026-11-10T02:30:00Z'), KYIV), 22.5 * HOUR);
});

test('counts seconds and milliseconds, not just whole minutes', () => {
  assert.equal(msUntilNextRun(at('2026-11-10T00:59:30.250Z'), KYIV), 29_750);
});

test('refuses to reset unless DEMO_RESET_ENABLED is "true"', () => {
  assert.throws(() => assertResetAllowed({}), /DEMO_RESET_ENABLED/);
  assert.throws(
    () => assertResetAllowed({ DEMO_RESET_ENABLED: 'yes' }),
    /DEMO_RESET_ENABLED/
  );
  assert.doesNotThrow(() => assertResetAllowed({ DEMO_RESET_ENABLED: 'true' }));
});
