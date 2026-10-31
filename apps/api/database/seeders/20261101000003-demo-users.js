/** @format */

'use strict';

// Demo admin-panel users (rules in ./data/demoUsers.js).

const bcrypt = require('bcrypt');
const { DEMO_USERS, credentialsFor } = require('./data/demoUsers');

const BCRYPT_ROUNDS = 10;

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
