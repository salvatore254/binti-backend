/**
 * Global Error Handler Middleware
 * Catches and handles all application errors
 */

const logger = require('../utils/logger');
const response = require('../utils/response');

/**
 * Error handling middleware
 * Must be defined last, after all other app.use() and routes calls
 */
const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log the error
  logger.error(`[${req.method} ${req.path}] ${err.message}`);

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation Error';
    errors = err.details || err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized Access';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource Not Found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  }

  // Send error response
  return response.error(res, message, statusCode, errors);
};

/**
 * 404 Not Found middleware
 * Handles undefined routes
 */
const notFoundHandler = (req, res) => {
  return response.error(res, 'Route not found', 404);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
