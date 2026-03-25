// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const MpesaService = require("../services/MpesaService");
const PesapalService = require("../services/PesapalService");
const PesapalServiceMock = require("../services/PesapalServiceMock");
const EmailService = require("../services/EmailService");
const Booking = require("../models/Booking");

// Initialize payment services (production or sandbox based on NODE_ENV)
const mpesaService = new MpesaService();

// Use mock Pesapal service if:
// 1. USE_PESAPAL_MOCK environment variable is set to 'true'
// 2. NODE_ENV is 'development' and PESAPAL_CONSUMER_KEY is not set (credentials missing)
const useMockPesapal = process.env.USE_PESAPAL_MOCK === 'true' || 
                       (process.env.NODE_ENV !== 'production' && !process.env.PESAPAL_CONSUMER_KEY);

const pesapalService = useMockPesapal 
  ? new PesapalServiceMock()
  : new PesapalService();

if (useMockPesapal) {
  console.log('[PAYMENT] ⚠️  Using MOCK Pesapal service for testing (no network access)');
  console.log('[PAYMENT] To use real Pesapal: Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in .env');
  console.log('[PAYMENT] Or disable mock: Set USE_PESAPAL_MOCK=false in .env');
}

// Get email service instance lazily when needed
const getEmailService = () => EmailService();

/**
 * In-memory cache for booking data
 * Stores booking details temporarily when payment is initiated
 * Removed after 30 minutes or when payment callback is received
 * NOTE: In production, use database instead of cache
 */
const bookingCache = {};

/**
 * M-Pesa is now configured for PRODUCTION (or SANDBOX based on NODE_ENV)
 * Pesapal endpoint is still a placeholder and should be replaced with actual implementation
 */

/**
 * POST /api/payments/pesapal
 * Body: { amount, email, phone, firstName, lastName, orderRef, description }
 * Returns: { success: true, iframe_url, orderTrackingId }
 * 
 * Creates a payment order via Pesapal API and returns the payment iframe URL
 */
router.post("/pesapal", async (req, res) => {
  try {
    const { amount, email, phone, firstName = 'Customer', lastName = 'Name', orderRef, description } = req.body;
    
    console.log(`[PAYMENT] Pesapal payment initiation:`, {
      amount,
      email,
      phone,
      orderRef
    });

    // Validate required fields
    if (!amount || !email || !orderRef) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: amount, email, orderRef"
      });
    }

    if (isNaN(amount) || amount <= 0 || amount > 999999) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount (must be between 1 and 999999 KES)"
      });
    }

    // Create payment order via Pesapal API
    const result = await pesapalService.createOrder({
      amount,
      currency: 'KES',
      orderRef: orderRef || uuidv4(),
      description: description || 'Binti Events Booking',
      email,
      phone: phone || '',
      firstName,
      lastName
    });

    // Cache booking data for confirmation email later
    const bookingData = {
      fullName: `${firstName} ${lastName}`,
      email: email,
      phone: phone || '',
      amount: amount,
      orderRef: orderRef,
      paymentMethod: 'pesapal',
      timestamp: new Date().toISOString()
    };

    // Store in cache with orderRef as key
    bookingCache[orderRef] = bookingData;
    console.log(`[PAYMENT] Booking data cached for ${orderRef}`);

    // Auto-clean cache after 1 hour (payment should complete within this time)
    setTimeout(() => {
      if (bookingCache[orderRef]) {
        delete bookingCache[orderRef];
        console.log(`[PAYMENT] Cache expired for ${orderRef}`);
      }
    }, 60 * 60 * 1000);

    return res.json({
      success: true,
      message: "Payment order created successfully",
      iframe_url: result.iframe_url,
      orderTrackingId: result.orderTrackingId,
      responseCode: result.responseCode
    });
  } catch (error) {
    console.error("[PAYMENT] Pesapal initiation failed:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Pesapal payment order creation failed"
    });
  }
});

/**
 * POST /api/payments/mpesa
 * Body: { phone, amount, accountRef, description }
 * Initiates STK push for M-Pesa payment (PRODUCTION or SANDBOX)
 * Returns: { success: true, checkoutRequestId, responseDescription }
 */
router.post("/mpesa", async (req, res) => {
  try {
    const { phone, amount, accountRef, description } = req.body;
    
    console.log(`[PAYMENT] M-Pesa payment initiation:`, {
      phone: phone ? `***${phone.slice(-4)}` : 'N/A',
      amount,
      accountRef
    });

    // Validate inputs
    if (!phone || !amount || !accountRef) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: phone, amount, accountRef"
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // Initiate STK push via Daraja API
    const result = await mpesaService.initiateStkPush(
      phone,
      amount,
      accountRef,
      description || "Binti Events Booking"
    );

    // Cache booking data for confirmation email later
    // This data comes from the frontend and includes customer & event details
    const bookingData = {
      fullName: req.body.fullName || req.body.fullname || 'Guest',
      email: req.body.email || '',
      phone: req.body.phone || '',
      venue: req.body.venue || '',
      eventDate: req.body.eventDate || '',
      setupTime: req.body.setupTime || '',
      tentType: req.body.tentType || req.body.bookingType || 'Package + Tent',
      amount: amount,
      mpesaPhone: phone,
      accountRef: accountRef,
      timestamp: new Date().toISOString()
    };

    // Store in cache with accountRef as key
    bookingCache[accountRef] = bookingData;
    console.log(`[PAYMENT] Booking data cached for ${accountRef}`);

    // Auto-clean cache after 30 minutes (payment should complete within this time)
    setTimeout(() => {
      if (bookingCache[accountRef]) {
        delete bookingCache[accountRef];
        console.log(`[PAYMENT] Cache expired for ${accountRef}`);
      }
    }, 30 * 60 * 1000);

    return res.json({
      success: true,
      message: "STK push initiated successfully",
      checkoutRequestId: result.checkoutRequestId,
      responseDescription: result.responseDescription,
      merchantRequestId: result.merchantRequestId
    });
  } catch (error) {
    console.error("[PAYMENT] M-Pesa initiation failed:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "M-Pesa STK push failed"
    });
  }
});

/**
 * Pesapal callback endpoint (IPN)
 * Pesapal will POST transaction results here after payment processing
 * Verifies payment status and sends confirmation
 */
router.post("/pesapal-callback", async (req, res) => {
  try {
    console.log("[PESAPAL CALLBACK] Callback received from Pesapal");
    console.log("[PESAPAL CALLBACK] Body:", JSON.stringify(req.body, null, 2));

    // Validate the callback
    const validation = pesapalService.validateCallback(req.body);
    
    if (!validation.valid) {
      console.warn("[PESAPAL CALLBACK] Invalid callback");
      return res.status(400).json({ success: false, message: 'Invalid callback' });
    }

    console.log("[PESAPAL CALLBACK] Parsed callback:", validation);

    // Retrieve cached booking data using orderTrackingId
    const cachedBooking = bookingCache[validation.orderTrackingId];
    
    if (cachedBooking) {
      console.log("[PESAPAL CALLBACK] Found cached booking data for", cachedBooking.fullName);
      
      // Check payment status from Pesapal
      try {
        const statusCheck = await pesapalService.getTransactionStatus(validation.orderTrackingId);
        
        if (statusCheck.status === 'COMPLETED' || statusCheck.status === 'PENDING') {
          console.log("[PESAPAL CALLBACK] ✅ Payment status:", statusCheck.status);
          
          // Prepare confirmation email data
          const confirmationData = {
            ...cachedBooking,
            orderTrackingId: validation.orderTrackingId,
            status: statusCheck.status,
            amount: statusCheck.amount,
            currency: statusCheck.currency,
            description: statusCheck.description,
            timestamp: new Date().toISOString()
          };
          
          // Send confirmation email
          try {
            console.log("[PESAPAL CALLBACK] Sending confirmation email to", cachedBooking.email);
            const emailResult = await getEmailService().sendPaymentConfirmation(cachedBooking, confirmationData);
            
            if (emailResult.success) {
              console.log("[PESAPAL CALLBACK] ✉️ Confirmation email sent successfully");
            } else {
              console.warn("[PESAPAL CALLBACK] ⚠️ Email sending failed:", emailResult.error);
            }
          } catch (emailError) {
            console.error("[PESAPAL CALLBACK] ❌ Error sending confirmation email:", emailError.message);
          }
          
          // Remove from cache after processing
          delete bookingCache[validation.orderTrackingId];
          console.log("[PESAPAL CALLBACK] Booking data cleared from cache");
          
          // TODO: In production, save payment details to database:
          // 1. Create/Update payment record with Pesapal details
          // 2. Update booking status to 'paid'
          // 3. Save order tracking ID and transaction timestamp
          // 4. Link payment to booking
          console.log("[PESAPAL CALLBACK] (DB TODO) Payment details would be saved to database");
        } else {
          console.warn("[PESAPAL CALLBACK] Payment not completed. Status:", statusCheck.status);
        }
      } catch (statusError) {
        console.error("[PESAPAL CALLBACK] Failed to check payment status:", statusError.message);
      }
    } else {
      console.warn("[PESAPAL CALLBACK] ⚠️ No cached booking found for", validation.orderTrackingId);
      console.warn("[PESAPAL CALLBACK] Available cache keys:", Object.keys(bookingCache));
    }

    // Always respond 200 OK to Pesapal (acknowledges receipt)
    res.sendStatus(200);
  } catch (error) {
    console.error("[PESAPAL CALLBACK] Error processing callback:", error.message);
    res.sendStatus(200); // Still respond 200 to avoid retry loop
  }
});

/**
 * Mpesa callback endpoint for STK Push / transaction result
 * Daraja will POST transaction results here
 * Processes successful payments and sends confirmation
 */
router.post("/mpesa-callback", async (req, res) => {
  try {
    console.log("[MPESA CALLBACK] Received callback from Daraja");
    console.log("[MPESA CALLBACK] Body:", JSON.stringify(req.body, null, 2));

    // Validate the callback
    const callbackData = mpesaService.validateCallback(req.body);
    
    console.log("[MPESA CALLBACK] Parsed callback:", callbackData);

    // Handle successful payment (resultCode 0 = success)
    if (callbackData.resultCode === 0) {
      console.log("[MPESA CALLBACK] ✅ Payment successful!");
      console.log("[MPESA CALLBACK] Receipt:", callbackData.mpesaReceiptNumber);
      console.log("[MPESA CALLBACK] Amount:", callbackData.amount);
      console.log("[MPESA CALLBACK] Phone:", callbackData.phoneNumber);

      // Retrieve cached booking data
      const cachedBooking = bookingCache[callbackData.accountRef];
      
      if (cachedBooking) {
        console.log("[MPESA CALLBACK] Found cached booking data for", cachedBooking.fullName);
        
        // Prepare confirmation email data
        const confirmationData = {
          ...cachedBooking,
          mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
          transactionDate: callbackData.transactionDate,
          resultCode: callbackData.resultCode
        };
        
        // Send confirmation email
        try {
          console.log("[MPESA CALLBACK] Sending confirmation email to", cachedBooking.email);
          const emailResult = await emailService.sendPaymentConfirmation(cachedBooking, confirmationData);
          
          if (emailResult.success) {
            console.log("[MPESA CALLBACK] ✉️ Confirmation email sent successfully (ID:", emailResult.messageId, ")");
          } else {
            console.warn("[MPESA CALLBACK] ⚠️ Email sending failed:", emailResult.error);
          }
        } catch (emailError) {
          console.error("[MPESA CALLBACK] ❌ Error sending confirmation email:", emailError.message);
        }
        
        // Remove from cache after processing
        delete bookingCache[callbackData.accountRef];
        console.log("[MPESA CALLBACK] Booking data cleared from cache");
        
        // TODO: In production, save payment details to database:
        // 1. Create/Update payment record with M-Pesa details
        // 2. Update booking status to 'paid'
        // 3. Save M-Pesa receipt number and transaction timestamp
        // 4. Link payment to booking
        console.log("[MPESA CALLBACK] (DB TODO) Payment details would be saved to database");
      } else {
        console.warn("[MPESA CALLBACK] ⚠️ No cached booking found for", callbackData.accountRef);
        console.warn("[MPESA CALLBACK] Available cache keys:", Object.keys(bookingCache));
      }
      
    } else {
      // Payment failed or was cancelled
      console.log("[MPESA CALLBACK] ❌ Payment failed or cancelled");
      console.log("[MPESA CALLBACK] ResultCode:", callbackData.resultCode);
      console.log("[MPESA CALLBACK] ResultDesc:", callbackData.resultDesc);
      
      // TODO: In production, update booking status:
      // 1. Find booking by accountRef
      // 2. Update status to 'failed' or 'cancelled'
      // 3. Send failure notification email to customer
      // 4. Notify admin of failed payment
      console.log("[MPESA CALLBACK] (DB TODO) Booking status would be updated to failed in database");
    }

    // Always respond 200 to acknowledge receipt (Daraja requirement)
    res.sendStatus(200);
  } catch (error) {
    console.error("[MPESA CALLBACK] Error processing callback:", error.message);
    console.error("[MPESA CALLBACK] Stack:", error.stack);
    res.sendStatus(200); // Still acknowledge to prevent Daraja retries
  }
});

module.exports = router;
