/**
 * Database Connection
 * Establishes and manages PostgreSQL database connections using Knex.js
 */

const knex = require('knex');
const config = require('../config/environment');
const logger = require('../utils/logger');
const databaseConfig = require('../config/database');

let db = null;

/**
 * Initialize database connection
 * Uses Knex.js for PostgreSQL connection pooling
 */
const initializeConnection = async () => {
  try {
    if (db) {
      logger.info('Database already initialized, returning existing connection');
      return db;
    }

    logger.info(`Initializing PostgreSQL database connection for ${config.NODE_ENV} environment`);
    logger.info(`Database: ${config.DB_NAME} @ ${config.DB_HOST}:${config.DB_PORT}`);

    // Create Knex instance with database configuration
    db = knex(databaseConfig);

    // Test the connection
    await db.raw('SELECT 1');
    
    logger.info(' Database connection established successfully');
    return db;
  } catch (err) {
    logger.error(' Failed to initialize database connection:', err.message);
    throw err;
  }
};

/**
 * Close database connection
 */
const closeConnection = async () => {
  try {
    if (db) {
      await db.destroy();
      logger.info(' Database connection closed');
      db = null;
    }
  } catch (err) {
    logger.error(' Error closing database connection:', err);
  }
};

/**
 * Get active database connection
 */
const getConnection = () => {
  if (!db) {
    throw new Error('Database connection not initialized. Call initializeConnection() first.');
  }
  return db;
};

/**
 * Check if connection is active
 */
const isConnected = () => {
  return db !== null;
};

/**
 * Query helper for common database operations
 */
const query = async (tableName) => {
  return getConnection()(tableName);
};

module.exports = {
  initializeConnection,
  closeConnection,
  getConnection,
  isConnected,
  query,
};
