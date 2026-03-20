/**
 * Response Formatter Utility
 * Standardizes API responses throughout the application
 */

const responseFormatter = {
  /**
   * Send success response
   * @param {object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  success: (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Send error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {object} errors - Additional error details (optional)
   */
  error: (res, message = 'An error occurred', statusCode = 500, errors = null) => {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Send validation error response
   * @param {object} res - Express response object
   * @param {object} errors - Validation errors
   */
  validationError: (res, errors) => {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Send paginated response
   * @param {object} res - Express response object
   * @param {array} data - Data array
   * @param {number} total - Total count
   * @param {number} page - Current page
   * @param {number} pageSize - Items per page
   * @param {string} message - Success message
   */
  paginated: (res, data, total, page, pageSize, message = 'Success') => {
    const totalPages = Math.ceil(total / pageSize);
    
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
      timestamp: new Date().toISOString(),
    });
  },
};

module.exports = responseFormatter;
