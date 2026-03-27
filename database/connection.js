/**
 * Database Connection (MongoDB via Mongoose)
 * Manages MongoDB connection with singleton pattern
 */

const mongoose = require('mongoose');
const config = require('../config/environment');
const logger = require('../utils/logger');

let isDbConnected = false;

/**
 * Initialize MongoDB connection
 * Automatically called on server startup
 */
const initializeConnection = async () => {
  try {
    if (isDbConnected) {
      logger.info('Database already connected');
      return mongoose.connection;
    }

    const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI || 
      `mongodb://${config.DB_HOST || 'localhost'}:${config.DB_PORT || 27017}/${config.DB_NAME || 'binti_events'}`;

    logger.info(`Connecting to MongoDB: ${mongoUri.replace(/:[^@]*@/, ':***@')}`);

    await mongoose.connect(mongoUri, {
      autoCreate: true,
      autoIndex: true,
    });

    isDbConnected = true;
    logger.info('MongoDB connected successfully');
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    throw error;
  }
};

/**
 * Get Mongoose connection instance
 */
const getConnection = () => {
  if (!isDbConnected) {
    throw new Error('Database not initialized. Call initializeConnection first.');
  }
  return mongoose.connection;
};

/**
 * Check if database is connected
 */
const isConnected = () => {
  return isDbConnected && mongoose.connection.readyState === 1;
};

/**
 * Close database connection
 */
const closeConnection = async () => {
  try {
    if (isDbConnected) {
      await mongoose.disconnect();
      isDbConnected = false;
      logger.info('MongoDB disconnected');
    }
  } catch (error) {
    logger.error(`Error closing database connection: ${error.message}`);
    throw error;
  }
};

/**
 * Query helper - returns the model for the specified collection
 * Usage: const bookings = await query('Booking').find();
 * 
 * @param {string} modelName - Name of the Mongoose model
 * @returns {Object} Mongoose model
 */
const query = (modelName) => {
  if (!isDbConnected) {
    throw new Error('Database not initialized');
  }
  
  // Import models
  const models = {
    'Booking': require('../models/Booking'),
  };

  if (!models[modelName]) {
    throw new Error(`Model "${modelName}" not found`);
  }

  return models[modelName];
};

module.exports = {
  initializeConnection,
  closeConnection,
  getConnection,
  isConnected,
  query,
};
