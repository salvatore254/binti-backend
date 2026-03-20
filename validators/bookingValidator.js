/**
 * Booking Validator
 * Validates booking form data
 */

const validateBookingData = (data) => {
  const errors = {};

  // Validate full name
  if (!data.fullname || data.fullname.trim() === '') {
    errors.fullname = 'Full name is required';
  } else if (data.fullname.length < 3) {
    errors.fullname = 'Full name must be at least 3 characters';
  }

  // Validate phone
  if (!data.phone || data.phone.trim() === '') {
    errors.phone = 'Phone number is required';
  } else {
    const phoneRegex = /^(\+254|0)[0-9]{9}$/;
    const phone = data.phone.replace(/\s/g, '');
    if (!phoneRegex.test(phone)) {
      errors.phone = 'Invalid Kenya phone number format';
    }
  }

  // Validate email
  if (!data.email || data.email.trim() === '') {
    errors.email = 'Email is required';
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.email = 'Invalid email format';
    }
  }

  // Validate tent type
  if (!data.tentType) {
    errors.tentType = 'Tent type is required';
  } else if (!['stretch', 'cheese', 'aframe', 'bline'].includes(data.tentType)) {
    errors.tentType = 'Invalid tent type';
  }

  // Validate venue location
  if (!data.location || data.location.trim() === '') {
    errors.location = 'Venue location is required';
  }

  // Validate tent size for stretch tents
  if (data.tentType === 'stretch' && !data.tentSize) {
    errors.tentSize = 'Tent size is required for stretch tents';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate payment data
 */
const validatePaymentData = (data) => {
  const errors = {};

  if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
    errors.amount = 'Valid amount is required';
  }

  if (!data.paymentMethod || !['mpesa', 'pesapal'].includes(data.paymentMethod)) {
    errors.paymentMethod = 'Valid payment method is required';
  }

  if (data.paymentMethod === 'mpesa' && !data.phone) {
    errors.phone = 'Phone number is required for M-Pesa payment';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  validateBookingData,
  validatePaymentData,
};
