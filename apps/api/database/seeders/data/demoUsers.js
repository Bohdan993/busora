/** @format */

// Demo admin-panel users. Credentials come from the environment and are never
// committed; a user whose variables are missing is skipped.
//   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
//   SEED_MANAGER_EMAIL / SEED_MANAGER_PASSWORD

const MIN_PASSWORD_LENGTH = 8;
// The admin login form and the API's login validation allow no more
const MAX_PASSWORD_LENGTH = 32;

const DEMO_USERS = [
  { role: 'admin', name: 'Demo Admin', envPrefix: 'SEED_ADMIN' },
  { role: 'manager', name: 'Demo Manager', envPrefix: 'SEED_MANAGER' }
];

function credentialsFor({ envPrefix }, env = process.env) {
  const email = env[`${envPrefix}_EMAIL`];
  const password = env[`${envPrefix}_PASSWORD`];
  if (!email || !password) {
    console.warn(`Skipping demo user: ${envPrefix}_EMAIL/_PASSWORD not set`);
    return null;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${envPrefix}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `${envPrefix}_PASSWORD must be at most ${MAX_PASSWORD_LENGTH} characters`
    );
  }
  return { email, password };
}

module.exports = { DEMO_USERS, credentialsFor };
