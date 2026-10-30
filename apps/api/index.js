require('module-alias/register');

// Load environment-specific .env file
const path = require('path');
const fs = require('fs');

// Determine which env file to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}.local`;
const envPath = path.resolve(__dirname, envFile);

// Load environment-specific file if it exists, otherwise fall back to .env
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envFile}`);
} else {
  require('dotenv').config();
  console.log('Loaded environment from: .env');
}

// Safety net: a stray rejection (e.g. a PDF/Chromium failure deep in a
// library) must not take the whole API process down. Log it and keep serving.
// Individual routes still handle their own errors; this is the backstop.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const { start: apiStart } = require('./api');

async function start() {
  try {
    await apiStart();
  } catch (err) {
    console.error(err);
  }
}

start();
