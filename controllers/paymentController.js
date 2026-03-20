/**
 * Payment Controller
 * Handles payment-related requests
 */

const response = require('../utils/response');
const logger = require('../utils/logger');
const { validatePaymentData } = require('../validators/bookingValidator');

/**
 * Process M-Pesa payment
 * POST /api/payments/mpesa
 */
const processMpesaPayment = async (req, res, next) => {
  try {
    const { phone, amount, accountRef } = req.body;

    // Validate payment data
    const validation = validatePaymentData({
      amount,
      phone,
      paymentMethod: 'mpesa',
    });

    if (!validation.isValid) {
      return response.validationError(res, validation.errors);
    }

    // TODO: Call Daraja API for STK Push
    logger.info(`M-Pesa payment initiated for ${phone} - KES ${amount}`);

    return response.success(res, {
      status: 'pending',
      message: 'STK Push sent to customer phone',
    }, 'Payment initiated successfully');
  } catch (err) {
    logger.error('Error processing M-Pesa payment', err);
    return response.error(res, 'Failed to initiate M-Pesa payment', 500);
  }
};

/**
 * Process Pesapal payment
 * POST /api/payments/pesapal
 */
const processPesapalPayment = async (req, res, next) => {
  try {
    const { amount, email, phone, orderRef } = req.body;

    // Validate payment data
    const validation = validatePaymentData({
      amount,
      paymentMethod: 'pesapal',
    });

    if (!validation.isValid) {
      return response.validationError(res, validation.errors);
    }

    // TODO: Call Pesapal API
    logger.info(`Pesapal payment initiated - KES ${amount} for ${orderRef}`);

    return response.success(res, {
      status: 'pending',
      iframeUrl: `https://demo.pesapal.com/iframe?orderRef=${encodeURIComponent(orderRef)}`,
    }, 'Pesapal payment initiated successfully');
  } catch (err) {
    logger.error('Error processing Pesapal payment', err);
    return response.error(res, 'Failed to initiate Pesapal payment', 500);
  }
};

/**
 * M-Pesa Payment Callback
 * POST /api/payments/mpesa-callback
 */
const mpesaCallback = async (req, res, next) => {
  try {
    const callbackData = req.body;

    logger.info(`M-Pesa callback received: ${JSON.stringify(callbackData)}`);

    // TODO: Verify signature and process payment
    // TODO: Update booking status to 'paid'

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    logger.error('Error processing M-Pesa callback', err);
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Error' });
  }
};

/**
 * Pesapal Payment Callback
 * GET /api/payments/pesapal-callback
 */
const pesapalCallback = async (req, res, next) => {
  try {
    const { order_tracking_id, pesapal_transaction_tracking_id } = req.query;

    logger.info(`Pesapal callback received: OrderId=${order_tracking_id}, TxnId=${pesapal_transaction_tracking_id}`);

    // TODO: Verify payment status with Pesapal API
    // TODO: Update booking status to 'paid'

    res.status(200).send('OK');
  } catch (err) {
    logger.error('Error processing Pesapal callback', err);
    res.status(500).send('Error');
  }
};

/**
 * Get payment status
 * GET /api/payments/:transactionId/status
 */
const getPaymentStatus = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    // TODO: Fetch from database
    // const payment = await PaymentService.getById(transactionId);

    return response.success(res, {
      transactionId,
      status: 'pending',
    }, 'Payment status retrieved successfully');
  } catch (err) {
    logger.error('Error retrieving payment status', err);
    return response.error(res, 'Failed to retrieve payment status', 500);
  }
};

module.exports = {
  processMpesaPayment,
  processPesapalPayment,
  mpesaCallback,
  pesapalCallback,
  getPaymentStatus,
};
