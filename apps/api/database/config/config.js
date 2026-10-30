// require("dotenv").config();

// Load environment-specific .env file
const path = require('path');
const fs = require('fs');
const rootDir = path.resolve(__dirname, '../../');

// Determine which env file to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}.local`;
const envPath = path.resolve(rootDir, envFile);

// Load environment-specific file if it exists, otherwise fall back to .env
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envFile}`);
} else {
  require('dotenv').config();
  console.log('Loaded environment from: .env');
}

const config = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT,
    // Use a different storage. Default: none
    seederStorage: 'sequelize',
    logging: (msg) =>
      console.log(msg, '(Date: ' + new Date().toUTCString() + ')')
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT,
    seederStorage: 'sequelize',
    logging: (msg) =>
      console.log(msg, '(Date: ' + new Date().toUTCString() + ')')
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT,
    seederStorage: 'sequelize',
    logging: (msg) =>
      console.log(msg, '(Date: ' + new Date().toUTCString() + ')')
  }
};

module.exports = config;
