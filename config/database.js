/**
 * Database Configuration
 * Sets up database connection pool and configuration
 */

const config = require('./environment');

const databaseConfig = {
  development: {
    client: 'pg',
    connection: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
    },
    migrations: {
      directory: './database/migrations',
    },
    seeds: {
      directory: './database/seeds',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 5,
      max: 30,
    },
    migrations: {
      directory: './database/migrations',
    },
  },
};

module.exports = databaseConfig[config.NODE_ENV] || databaseConfig.development;
