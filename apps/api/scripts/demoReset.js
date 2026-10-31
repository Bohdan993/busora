/** @format */

// Resets the public demo to a fresh state: drops every table, runs the
// migrations and seeders again (flight dates are relative to the run day, so
// the timetable moves forward), deletes the generated ticket PDFs, and empties
// the Mailpit inbox and the session store.
//
//   node scripts/demoReset.js          reset once
//   node scripts/demoReset.js --daily  reset every night at 03:00 Kyiv time
//
// It deletes every booking, so it runs only with DEMO_RESET_ENABLED=true.

require('module-alias/register');
const fs = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RUN_AT = { hour: 3, timeZone: 'Europe/Kyiv' };
const API_ROOT = path.resolve(__dirname, '..');
const TICKETS_DIR = path.join(API_ROOT, 'assets', 'tickets');

function assertResetAllowed(env) {
  if (env.DEMO_RESET_ENABLED !== 'true') {
    throw new Error(
      'Refusing to reset: DEMO_RESET_ENABLED is not "true" (the reset deletes every booking).'
    );
  }
}

/** Milliseconds from `now` until the next `hour`:00 in `timeZone`. */
function msUntilNextRun(now, { hour, timeZone }) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)])
  );
  const sinceMidnightMs =
    ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 +
    now.getMilliseconds();
  const wait = (hour * HOUR_MS - sinceMidnightMs + DAY_MS) % DAY_MS;
  return wait === 0 ? DAY_MS : wait;
}

function log(message) {
  console.log(`[demo-reset ${new Date().toISOString()}] ${message}`);
}

function npmRun(script) {
  const result = spawnSync('npm', ['run', script], {
    cwd: API_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed (exit ${result.status})`);
  }
}

async function dropAllTables() {
  const { Sequelize } = require('sequelize');
  const config = require('@database/config/config.js')[
    process.env.NODE_ENV || 'development'
  ];
  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      ...config,
      logging: false
    }
  );
  try {
    // Includes SequelizeMeta and SequelizeData, so migrations and seeders
    // all run again
    await sequelize.getQueryInterface().dropAllTables();
  } finally {
    await sequelize.close();
  }
}

async function deleteTicketFiles() {
  const entries = await fs.readdir(TICKETS_DIR).catch(() => []);
  await Promise.all(
    entries.map((name) =>
      fs.rm(path.join(TICKETS_DIR, name), { recursive: true, force: true })
    )
  );
  return entries.length;
}

async function emptyMailbox() {
  if (!process.env.MAILPIT_URL) return false;
  const response = await fetch(`${process.env.MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Mailpit answered ${response.status}`);
  }
  return true;
}

async function flushSessions() {
  if (!process.env.REDIS_HOST) return false;
  const { createClient } = require('redis');
  const { redisConfig } = require('../config/app.config');
  const client = createClient(redisConfig);
  await client.connect();
  try {
    await client.flushDb();
  } finally {
    await client.quit();
  }
  return true;
}

async function resetDemo() {
  log('dropping all tables');
  await dropAllTables();
  log('migrating and seeding');
  npmRun('migrate');
  npmRun('seed');
  log(`deleted ${await deleteTicketFiles()} ticket file(s)`);
  if (await emptyMailbox()) log('emptied the Mailpit inbox');
  if (await flushSessions()) log('cleared the session store');
  log('done');
}

async function main() {
  assertResetAllowed(process.env);
  if (!process.argv.includes('--daily')) {
    await resetDemo();
    return;
  }
  for (;;) {
    const wait = msUntilNextRun(new Date(), RUN_AT);
    log(`next reset in ${Math.round(wait / 60000)} min`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    // A failed night must not stop the next one
    await resetDemo().catch((error) => log(`reset failed: ${error.message}`));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { msUntilNextRun, assertResetAllowed };
