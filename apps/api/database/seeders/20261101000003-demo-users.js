/** @format */

'use strict';

// Demo admin-panel users. Credentials come from the environment and are never
// committed; a user whose variables are missing is skipped.
//   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
//   SEED_MANAGER_EMAIL / SEED_MANAGER_PASSWORD

const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

const DEMO_USERS = [
  { role: 'admin', name: 'Demo Admin', envPrefix: 'SEED_ADMIN' },
  { role: 'manager', name: 'Demo Manager', envPrefix: 'SEED_MANAGER' }
];

function credentialsFor({ envPrefix }) {
  const email = process.env[`${envPrefix}_EMAIL`];
  const password = process.env[`${envPrefix}_PASSWORD`];
  if (!email || !password) {
    console.warn(`Skipping demo user: ${envPrefix}_EMAIL/_PASSWORD not set`);
    return null;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${envPrefix}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  return { email, password };
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [];
    for (const user of DEMO_USERS) {
      const credentials = credentialsFor(user);
      if (!credentials) continue;
      rows.push({
        name: user.name,
        email: credentials.email,
        password: await bcrypt.hash(credentials.password, BCRYPT_ROUNDS),
        role: user.role,
        isActivated: true,
        isBlocked: false,
        createdAt: now,
        updatedAt: now
      });
    }
    if (rows.length > 0) await queryInterface.bulkInsert('users', rows);
  },

  async down(queryInterface) {
    const emails = DEMO_USERS.map(
      ({ envPrefix }) => process.env[`${envPrefix}_EMAIL`]
    ).filter(Boolean);
    if (emails.length > 0) {
      await queryInterface.bulkDelete('users', { email: emails });
    }
  }
};
