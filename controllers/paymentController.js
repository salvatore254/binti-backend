/**
 * Payment Controller
 * Handles payment-related requests and callbacks
 */

const response = require('../utils/response');
const logger = require('../utils/logger');
const { validatePaymentData } = require('../validators/bookingValidator');
const { query } = require('../database/connection');
const InvoiceService = require('../services/InvoiceService');
const WhatsAppService = require('../services/WhatsAppService');
const invoiceService = new InvoiceService();
const whatsAppService = WhatsAppService();

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

    // Log M-Pesa payment initiation
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
    const { amount, email, phone, bookingId } = req.body;

    // Validate payment data
    const validation = validatePaymentData({
      amount,
      paymentMethod: 'pesapal',
    });

    if (!validation.isValid) {
      return response.validationError(res, validation.errors);
    }

    // Log Pesapal payment initiation
    logger.info(`Pesapal payment initiated - KES ${amount} for booking ${bookingId}`);

    return response.success(res, {
      status: 'pending',
      message: 'Pesapal iframe loaded',
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

    // Extract payment details from callback
    const { Body } = callbackData;
    if (!Body) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback format' });
    }

    const { stkCallback } = Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    // ResultCode: 0 = success, anything else = failure
    if (ResultCode === 0) {
      const { CallbackMetadata } = stkCallback;
      const { Item } = CallbackMetadata;
      
      let amount, phone, reference;
      Item.forEach(item => {
        if (item.Name === 'Amount') amount = item.Value;
        if (item.Name === 'PhoneNumber') phone = item.Value;
        if (item.Name === 'MpesaReceiptNumber') reference = item.Value;
      });

      logger.info(`M-Pesa Payment Success: ${reference} from ${phone} - KES ${amount}`);

      // Extract AccountReference which contains the bookingId
      let bookingId = null;
      Item.forEach(item => {
        if (item.Name === 'AccountReference') bookingId = item.Value;
      });

      // Update booking in MongoDB with payment confirmation
      // Use bookingId (accountRef) as primary lookup, not phone number (more reliable)
      const Booking = query('Booking');
      let booking = null;
      
      if (bookingId) {
        // Try to find by bookingId first (most reliable)
        booking = await Booking.findByIdAndUpdate(
          bookingId,
          {
            status: 'paid',
            paymentMethod: 'mpesa',
            transactionId: reference,
            updatedAt: new Date(),
          },
          { new: true }
        );
        
        if (booking) {
          logger.info(`Booking ${booking._id} updated to paid status via M-Pesa (found by ID)`);
        } else {
          logger.warn(`Booking not found by ID ${bookingId}, trying phone lookup...`);
        }
      }
      
      // Fallback: Try phone lookup if ID lookup failed
      if (!booking && phone) {
        booking = await Booking.findOneAndUpdate(
          { mpesaPhone: phone.toString() },
          {
            status: 'paid',
            paymentMethod: 'mpesa',
            transactionId: reference,
            updatedAt: new Date(),
          },
          { new: true }
        );
        
        if (booking) {
          logger.info(`Booking ${booking._id} updated to paid status via M-Pesa (found by phone)`);
        }
      }

      if (booking) {
        
        // Send WhatsApp notifications asynchronously (non-blocking)
        (async () => {
          try {
            // Send booking confirmation to customer
            const customerResult = await whatsAppService.sendBookingConfirmation(booking);
            if (customerResult.success) {
              logger.info(`[MPESA-CALLBACK] WhatsApp sent to customer: ${booking.phone}`);
            } else {
              logger.warn(`[MPESA-CALLBACK] Failed to send WhatsApp to customer: ${customerResult.message}`);
            }
            
            // Send admin alert
            const adminResult = await whatsAppService.sendAdminAlert(booking);
            if (adminResult.success) {
              logger.info(`[MPESA-CALLBACK] WhatsApp alert sent to admin`);
            } else {
              logger.warn(`[MPESA-CALLBACK] Failed to send admin alert: ${adminResult.message}`);
            }
          } catch (whatsappErr) {
            logger.error(`[MPESA-CALLBACK] WhatsApp error:`, whatsappErr.message);
          }
        })();
        
        // Send invoice asynchronously and mark as sent
        invoiceService.sendInvoice(booking).then(async (success) => {
          if (success) {
            booking.invoiceSent = true;
            booking.invoiceSentAt = new Date();
            await booking.save();
            logger.info(`Invoice sent and flagged for booking ${booking._id}`);
          }
        }).catch(err => {
          logger.error(`Failed to send invoice for booking ${booking._id}: ${err.message}`);
        });
      } else {
        logger.warn(`No booking found for M-Pesa phone: ${phone}`);
      }
    } else {
      logger.warn(`M-Pesa Payment Failed: ${ResultDesc}`);
    }

    // Return success to M-Pesa API
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

    logger.info(`Pesapal callback received: order=${order_tracking_id}, transaction=${pesapal_transaction_tracking_id}`);

    // Update booking with payment confirmation if we have a transaction ID
    if (pesapal_transaction_tracking_id) {
      const Booking = query('Booking');
      const booking = await Booking.findByIdAndUpdate(
        order_tracking_id,
        {
          status: 'paid',
          paymentMethod: 'pesapal',
          transactionId: pesapal_transaction_tracking_id,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (booking) {
        logger.info(`Booking ${booking._id} updated to paid status via Pesapal`);
        
        // Send WhatsApp notifications asynchronously (non-blocking)
        (async () => {
          try {
            // Send booking confirmation to customer
            const customerResult = await whatsAppService.sendBookingConfirmation(booking);
            if (customerResult.success) {
              logger.info(`[PESAPAL-CALLBACK] WhatsApp sent to customer: ${booking.phone}`);
            } else {
              logger.warn(`[PESAPAL-CALLBACK] Failed to send WhatsApp to customer: ${customerResult.message}`);
            }
            
            // Send admin alert
            const adminResult = await whatsAppService.sendAdminAlert(booking);
            if (adminResult.success) {
              logger.info(`[PESAPAL-CALLBACK] WhatsApp alert sent to admin`);
            } else {
              logger.warn(`[PESAPAL-CALLBACK] Failed to send admin alert: ${adminResult.message}`);
            }
          } catch (whatsappErr) {
            logger.error(`[PESAPAL-CALLBACK] WhatsApp error:`, whatsappErr.message);
          }
        })();
        
        // Send invoice asynchronously and mark as sent
        invoiceService.sendInvoice(booking).then(async (success) => {
          if (success) {
            booking.invoiceSent = true;
            booking.invoiceSentAt = new Date();
            await booking.save();
            logger.info(`Invoice sent and flagged for booking ${booking._id}`);
          }
        }).catch(err => {
          logger.error(`Failed to send invoice for booking ${booking._id}: ${err.message}`);
        });
      } else {
        logger.warn(`No booking found with ID: ${order_tracking_id}`);
      }
    } else {
      logger.warn('Pesapal callback missing transaction ID');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Error processing Pesapal callback', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get payment status
 * GET /api/payments/status/:bookingId
 */
const getPaymentStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const Booking = query('Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return response.error(res, 'Booking not found', 404);
    }

    logger.info(`Payment status retrieved for booking: ${bookingId}`);

    return response.success(res, {
      bookingId: booking._id,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      totalAmount: booking.totalAmount,
      transactionId: booking.transactionId,
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
