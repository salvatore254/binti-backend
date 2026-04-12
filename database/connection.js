/**
 * Database Connection (PostgreSQL via pg)
 * Manages Postgres connection pooling and schema bootstrapping
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config/environment');
const logger = require('../utils/logger');

let pool = null;
let isDbConnected = false;

const maskConnectionString = (value) => String(value || '').replace(/:[^:@/]+@/, ':***@');

const getConnectionConfig = () => {
  if (config.DATABASE_URL) {
    return {
      connectionString: config.DATABASE_URL,
      ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: config.PGHOST || '127.0.0.1',
    port: Number(config.PGPORT || 5432),
    database: config.PGDATABASE || 'binti_events',
    user: config.PGUSER || 'postgres',
    password: config.PGPASSWORD || '',
    ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined,
  };
};

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, 'postgres');
  const files = fs.readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8').trim();
    if (!sql) {
      continue;
    }

    logger.info(`Applying Postgres migration ${fileName}`);
    await pool.query(sql);
  }
};

const initializeConnection = async () => {
  try {
    if (isDbConnected && pool) {
      logger.info('Database already connected');
      return pool;
    }

    const connectionConfig = getConnectionConfig();
    const connectionLabel = connectionConfig.connectionString
      ? maskConnectionString(connectionConfig.connectionString)
      : `${connectionConfig.user}@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`;

    logger.info(`Connecting to PostgreSQL: ${connectionLabel}`);

    pool = new Pool(connectionConfig);
    await pool.query('SELECT 1');
    await runMigrations();

    isDbConnected = true;
    logger.info('PostgreSQL connected successfully');
    return pool;
  } catch (error) {
    const errorSummary = [
      error.message || error.code || 'Unknown database connection error',
      error.code ? `code=${error.code}` : null,
      error.detail ? `detail=${error.detail}` : null,
      error.errno ? `errno=${error.errno}` : null,
    ].filter(Boolean).join(' | ');

    logger.error(`Database connection error: ${errorSummary}`);
    throw error;
  }
};

const getConnection = () => {
  if (!isDbConnected || !pool) {
    throw new Error('Database not initialized. Call initializeConnection first.');
  }

  return pool;
};

const isConnected = () => isDbConnected;

const closeConnection = async () => {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      isDbConnected = false;
      logger.info('PostgreSQL disconnected');
    }
  } catch (error) {
    logger.error(`Error closing database connection: ${error.message}`);
    throw error;
  }
};

const query = async (text, params = []) => {
  if (!isDbConnected || !pool) {
    throw new Error('Database not initialized');
  }

  return pool.query(text, params);
};

module.exports = {
  initializeConnection,
  closeConnection,
  getConnection,
  isConnected,
  query,
};
