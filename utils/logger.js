/**
 * Logger Utility
 * Provides logging functionality for application errors and info
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logger = {
  /**
   * Log error messages
   * @param {string} message - Error message
   * @param {object} error - Error object (optional)
   */
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    const errorLog = `[${timestamp}] ERROR: ${message}`;
    
    console.error(errorLog);
    if (error) {
      console.error(error.stack || error);
    }
    
    // Write to error log file
    const logFile = path.join(logsDir, 'error.log');
    fs.appendFileSync(logFile, errorLog + '\n', { encoding: 'utf-8' });
    if (error) {
      fs.appendFileSync(logFile, (error.stack || JSON.stringify(error)) + '\n', { encoding: 'utf-8' });
    }
  },

  /**
   * Log info messages
   * @param {string} message - Info message
   */
  info: (message) => {
    const timestamp = new Date().toISOString();
    const infoLog = `[${timestamp}] INFO: ${message}`;
    
    console.log(infoLog);
    
    // Write to info log file
    const logFile = path.join(logsDir, 'info.log');
    fs.appendFileSync(logFile, infoLog + '\n', { encoding: 'utf-8' });
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   */
  warn: (message) => {
    const timestamp = new Date().toISOString();
    const warnLog = `[${timestamp}] WARN: ${message}`;
    
    console.warn(warnLog);
    
    // Write to warn log file
    const logFile = path.join(logsDir, 'warn.log');
    fs.appendFileSync(logFile, warnLog + '\n', { encoding: 'utf-8' });
  },
};

module.exports = logger;
