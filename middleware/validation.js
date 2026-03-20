/**
 * Validation Middleware
 * Validates incoming request data
 */

const response = require('../utils/response');

/**
 * Validate required fields in request body
 * @param {array} requiredFields - Array of required field names
 */
const validateRequired = (requiredFields) => {
  return (req, res, next) => {
    const errors = {};
    
    requiredFields.forEach((field) => {
      if (!req.body[field] || req.body[field].toString().trim() === '') {
        errors[field] = `${field} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      return response.validationError(res, errors);
    }

    next();
  };
};

/**
 * Validate email format
 */
const validateEmail = (req, res, next) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (req.body.email && !emailRegex.test(req.body.email)) {
    return response.validationError(res, {
      email: 'Invalid email format',
    });
  }

  next();
};

/**
 * Validate phone number format
 */
const validatePhone = (req, res, next) => {
  const phoneRegex = /^(\+254|0)[0-9]{9}$/;
  const phone = req.body.phone?.replace(/\s/g, '');
  
  if (req.body.phone && !phoneRegex.test(phone)) {
    return response.validationError(res, {
      phone: 'Invalid Kenya phone number format (+254XXXXXXXXX or 0XXXXXXXXX)',
    });
  }

  next();
};

/**
 * Validate numeric fields
 */
const validateNumeric = (fields) => {
  return (req, res, next) => {
    const errors = {};
    
    fields.forEach((field) => {
      if (req.body[field] && isNaN(req.body[field])) {
        errors[field] = `${field} must be a number`;
      }
    });

    if (Object.keys(errors).length > 0) {
      return response.validationError(res, errors);
    }

    next();
  };
};

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validateNumeric,
};
