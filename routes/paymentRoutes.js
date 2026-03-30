// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
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

const testEndpointsEnabled = process.env.ENABLE_TEST_ENDPOINTS === 'true';

const ensureTestEndpointsEnabled = (res) => {
  if (testEndpointsEnabled) {
    return true;
  }

  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
  return false;
};

const getExpectedDepositAmount = (booking) => {
  if (Number.isFinite(Number(booking.depositAmount)) && Number(booking.depositAmount) > 0) {
    return Math.round(Number(booking.depositAmount));
  }

  return Math.round(Number(booking.totalAmount || 0) * 0.8);
};

const amountsMatch = (actual, expected) => Math.round(Number(actual)) === Math.round(Number(expected));

const buildPesapalOrderRef = (bookingId) => {
  const bookingRef = String(bookingId || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-16);
  const suffix = uuidv4().replace(/-/g, '').slice(0, 8);
  return `ORD_${bookingRef}_${suffix}`;
};

const getPesapalCallbackPayload = (req) => ({
  ...(req.query || {}),
  ...(req.body || {}),
});

const handlePesapalCallback = async (req, res) => {
  try {
    console.log("[PESAPAL CALLBACK] Callback received from Pesapal");
    const callbackPayload = getPesapalCallbackPayload(req);
    console.log("[PESAPAL CALLBACK] Payload:", JSON.stringify(callbackPayload, null, 2));

    const validation = pesapalService.validateCallback(callbackPayload);

    if (!validation.valid) {
      console.warn("[PESAPAL CALLBACK] Invalid callback");
      return res.status(400).json({ success: false, message: 'Invalid callback' });
    }

    console.log("[PESAPAL CALLBACK] Parsed callback:", validation);

    const booking = await Booking.findOne({ pesapalOrderTrackingId: validation.orderTrackingId });

    if (!booking) {
      console.warn("[PESAPAL CALLBACK] No booking found for", validation.orderTrackingId);
      return res.sendStatus(200);
    }

    const statusCheck = await pesapalService.getTransactionStatus(validation.orderTrackingId);
    console.log("[PESAPAL CALLBACK] Payment status:", statusCheck.status);

    if (statusCheck.status !== 'COMPLETED') {
      console.warn("[PESAPAL CALLBACK] Payment not completed. Status:", statusCheck.status);
      return res.sendStatus(200);
    }

    const expectedAmount = getExpectedDepositAmount(booking);
    if (!amountsMatch(statusCheck.amount, expectedAmount)) {
      booking.status = 'payment_failed';
      booking.paymentFailureReason = 'Pesapal callback amount mismatch';
      booking.lastPaymentError = `Expected ${expectedAmount} but received ${statusCheck.amount}`;
      booking.lastPaymentAttempt = new Date();
      booking.updatedAt = new Date();
      await booking.save();
      console.error("[PESAPAL CALLBACK] Amount mismatch for booking", booking._id);
      return res.sendStatus(200);
    }

    booking.status = 'paid';
    booking.paymentMethod = 'pesapal';
    booking.transactionId = validation.transactionTrackingId || validation.orderTrackingId;
    booking.updatedAt = new Date();
    await booking.save();

    try {
      console.log("[PESAPAL CALLBACK] Sending confirmation email to", booking.email);
      const emailService = getEmailService();
      const emailResult = await emailService.sendPaymentConfirmation(booking, booking.transactionId);

      if (emailResult.success) {
        console.log("[PESAPAL CALLBACK] Confirmation email sent successfully");
      } else {
        console.warn("[PESAPAL CALLBACK] Email sending failed:", emailResult.error);
      }
    } catch (emailError) {
      console.error("[PESAPAL CALLBACK] Error sending confirmation email:", emailError.message);
    }

    try {
      const InvoiceService = require('../services/InvoiceService');
      const invoiceService = new InvoiceService();
      const invoiceSent = await invoiceService.sendInvoice(booking);
      if (invoiceSent) {
        booking.invoiceSent = true;
        booking.invoiceSentAt = new Date();
        await booking.save();
      }
    } catch (invoiceErr) {
      console.error("[PESAPAL CALLBACK] Invoice error:", invoiceErr.message);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("[PESAPAL CALLBACK] Error processing callback:", error.message);
    return res.sendStatus(200);
  }
};

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
    const { bookingId: rawBookingId, orderRef: rawOrderRef, description } = req.body;
    const bookingId = rawBookingId || rawOrderRef;
    
    console.log(`[PAYMENT] Pesapal payment initiation:`, {
      bookingId,
    });

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: bookingId"
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const expectedAmount = getExpectedDepositAmount(booking);
    const orderRef = buildPesapalOrderRef(booking._id);
    const [firstName = 'Customer', ...restOfName] = String(booking.fullname || 'Customer Name').split(' ');
    const lastName = restOfName.join(' ') || 'Name';

    // Create payment order via Pesapal API
    const result = await pesapalService.createOrder({
      amount: expectedAmount,
      currency: 'KES',
      orderRef,
      description: description || 'Binti Events Booking',
      email: booking.email,
      phone: booking.phone || '',
      firstName,
      lastName
    });

    await Booking.findByIdAndUpdate(booking._id, {
      paymentMethod: 'pesapal',
      pesapalOrderRef: orderRef,
      pesapalOrderTrackingId: result.orderTrackingId,
      updatedAt: new Date(),
    });

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
    if (!phone || !accountRef) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: phone, accountRef"
      });
    }

    const booking = await Booking.findById(accountRef);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const expectedAmount = getExpectedDepositAmount(booking);
    if (amount !== undefined && !amountsMatch(amount, expectedAmount)) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch. Use the booking deposit amount.",
        expectedAmount,
      });
    }

    // Initiate STK push via Daraja API
    const result = await mpesaService.initiateStkPush(
      phone,
      expectedAmount,
      accountRef,
      description || "Binti Events Booking"
    );

    // CRITICAL: Save checkoutRequestId on the booking document
    // This is the ONLY reliable identifier M-Pesa returns in callbacks
    // (AccountRef is truncated, Phone can be null in sandbox)
    try {
      await Booking.findByIdAndUpdate(accountRef, {
        checkoutRequestId: result.checkoutRequestId,
        paymentMethod: 'mpesa',
        mpesaPhone: phone,
        updatedAt: new Date()
      });
      console.log(`[PAYMENT] ✅ Saved checkoutRequestId ${result.checkoutRequestId} on booking ${accountRef}`);
    } catch (dbErr) {
      console.error(`[PAYMENT] ⚠️ Failed to save checkoutRequestId on booking:`, dbErr.message);
    }

    // Cache booking data keyed by checkoutRequestId (NOT accountRef)
    // This is used when callback comes back to send confirmation emails
    const bookingData = {
      _id: booking._id,
      id: booking._id,
      fullname: booking.fullname || 'Guest',
      email: booking.email || '',
      phone: booking.phone || phone,
      venue: booking.venue || '',
      eventDate: booking.eventDate || '',
      setupTime: booking.setupTime || '',
      tentType: booking.tentType || req.body.bookingType || 'Package + Tent',
      totalAmount: booking.totalAmount,
      mpesaPhone: phone,
      accountRef: accountRef,
      checkoutRequestId: result.checkoutRequestId,
      timestamp: new Date().toISOString()
    };

    // Store in cache with checkoutRequestId as key (reliable in callback)
    bookingCache[result.checkoutRequestId] = bookingData;
    console.log(`[PAYMENT] Booking data cached with checkoutRequestId: ${result.checkoutRequestId}`);

    // Auto-clean cache after 30 minutes (payment should complete within this time)
    setTimeout(() => {
      if (bookingCache[result.checkoutRequestId]) {
        delete bookingCache[result.checkoutRequestId];
        console.log(`[PAYMENT] Cache expired for checkoutRequestId: ${result.checkoutRequestId}`);
      }
    }, 30 * 60 * 1000);

    return res.json({
      success: true,
      status: 'pending',
      message: "STK push initiated successfully - customer should see prompt on their phone",
      checkoutRequestId: result.checkoutRequestId,
      responseCode: result.responseCode,
      responseDescription: result.responseDescription,
      merchantRequestId: result.merchantRequestId,
      instruction: "Confirm the prompt on your phone to complete payment",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[PAYMENT] M-Pesa initiation failed:", error.message);
    console.error("[PAYMENT] Full error:", error);
    return res.status(500).json({
      success: false,
      status: 'failed',
      message: error.message || "M-Pesa STK push failed",
      error: error.message,
      debugging: {
        timestamp: new Date().toISOString(),
        hint: "Check M-Pesa credentials and phone number format (should be 254712345678)"
      }
    });
  }
});

/**
 * Pesapal callback endpoint (IPN)
 * Pesapal will POST transaction results here after payment processing
 * Verifies payment status, updates database, and sends confirmation
 */
router.post("/pesapal-callback", handlePesapalCallback);
router.get("/pesapal-callback", handlePesapalCallback);

/**
 * Mpesa callback endpoint for STK Push / transaction result
 * Daraja will POST transaction results here
 * Processes successful payments, updates database, and sends confirmation
 */
router.post("/mpesa-callback", async (req, res) => {
  try {
    console.log("[MPESA CALLBACK] Received callback from Daraja");
    console.log("[MPESA CALLBACK] Body:", JSON.stringify(req.body, null, 2));

    // Validate the callback using M-Pesa service validation
    const callbackData = mpesaService.validateCallback(req.body);
    
    console.log("[MPESA CALLBACK] Parsed callback data:");
    console.log("  CheckoutRequestID:", callbackData.checkoutRequestId);
    console.log("  ResultCode:", callbackData.resultCode);
    console.log("  ResultDesc:", callbackData.resultDesc);

    // CheckoutRequestID is the ONLY reliable identifier from M-Pesa callbacks
    // AccountRef and PhoneNumber can be null (especially in sandbox or error callbacks)
    const checkoutRequestId = callbackData.checkoutRequestId;
    
    if (!checkoutRequestId) {
      console.error("[MPESA CALLBACK] ❌ No CheckoutRequestID in callback! Cannot process.");
      return res.sendStatus(200);
    }

    // Look up booking by checkoutRequestId (saved when STK push was initiated)
    let booking = await Booking.findOne({ checkoutRequestId: checkoutRequestId });
    let cachedBooking = bookingCache[checkoutRequestId] || null;
    
    console.log("[MPESA CALLBACK] Booking found by checkoutRequestId:", !!booking);
    console.log("[MPESA CALLBACK] Cached booking found:", !!cachedBooking);

    if (!booking && cachedBooking && cachedBooking._id) {
      // Fallback: try finding by cached booking ID
      console.log("[MPESA CALLBACK] Trying cached booking ID fallback:", cachedBooking._id);
      booking = await Booking.findById(cachedBooking._id);
    }

    if (!booking) {
      console.error("[MPESA CALLBACK] ❌ No booking found for checkoutRequestId:", checkoutRequestId);
      console.error("[MPESA CALLBACK] Cache keys available:", Object.keys(bookingCache));
      return res.sendStatus(200);
    }

    console.log("[MPESA CALLBACK] ✅ Found booking:", booking._id, "for", booking.fullname);

    // Handle successful payment (resultCode 0 = success)
    if (callbackData.resultCode === 0) {
      console.log("[MPESA CALLBACK] Payment successful!");
      console.log("[MPESA CALLBACK] Receipt:", callbackData.mpesaReceiptNumber);
      console.log("[MPESA CALLBACK] Amount:", callbackData.amount);

      const expectedAmount = getExpectedDepositAmount(booking);
      if (!amountsMatch(callbackData.amount, expectedAmount)) {
        booking.status = 'payment_failed';
        booking.paymentFailureReason = 'M-Pesa callback amount mismatch';
        booking.paymentFailureCode = callbackData.resultCode;
        booking.lastPaymentAttempt = new Date();
        booking.lastPaymentError = `Expected ${expectedAmount} but received ${callbackData.amount}`;
        booking.updatedAt = new Date();
        await booking.save();
        console.error("[MPESA CALLBACK] Amount mismatch for booking", booking._id);
        delete bookingCache[checkoutRequestId];
        return res.sendStatus(200);
      }

      booking.status = 'paid';
      booking.paymentMethod = 'mpesa';
      booking.transactionId = callbackData.mpesaReceiptNumber;
      booking.updatedAt = new Date();
      await booking.save();

      console.log("[MPESA CALLBACK] Booking status updated to PAID (ID:", booking._id, ")");

      // Send confirmation email
      try {
        const emailData = cachedBooking || booking;
        console.log("[MPESA CALLBACK] Sending payment confirmation email to", emailData.email);
        const emailService = getEmailService();
        const emailResult = await emailService.sendPaymentConfirmation(emailData, callbackData.mpesaReceiptNumber);
        
        if (emailResult.success) {
          console.log("[MPESA CALLBACK] Confirmation email sent (ID:", emailResult.messageId, ")");
        } else {
          console.warn("[MPESA CALLBACK] Email failed:", emailResult.error);
        }
      } catch (emailError) {
        console.error("[MPESA CALLBACK] Email error:", emailError.message);
      }

      // Send invoice and mark as sent
      try {
        const InvoiceService = require('../services/InvoiceService');
        const invoiceService = new InvoiceService();
        const invoiceSent = await invoiceService.sendInvoice(booking);
        if (invoiceSent) {
          booking.invoiceSent = true;
          booking.invoiceSentAt = new Date();
          await booking.save();
          console.log("[MPESA CALLBACK] Invoice sent and flagged for booking", booking._id);
        }
      } catch (invoiceErr) {
        console.error("[MPESA CALLBACK] Invoice error:", invoiceErr.message);
      }

    } else {
      // Payment failed or was cancelled
      console.log("[MPESA CALLBACK] Payment failed/cancelled");
      console.log("[MPESA CALLBACK] ResultCode:", callbackData.resultCode);
      console.log("[MPESA CALLBACK] ResultDesc:", callbackData.resultDesc);

      booking.status = 'payment_failed';
      booking.paymentFailureReason = callbackData.resultDesc;
      booking.paymentFailureCode = callbackData.resultCode;
      booking.lastPaymentAttempt = new Date();
      booking.lastPaymentError = callbackData.resultCodeDescription;
      booking.updatedAt = new Date();
      await booking.save();

      console.log("[MPESA CALLBACK] ✅ Booking status updated to payment_failed (ID:", booking._id, ")");
    }

    // Clean up cache
    delete bookingCache[checkoutRequestId];
    console.log("[MPESA CALLBACK] Cache cleared");

    // Always respond 200 to acknowledge receipt (Daraja requirement)
    res.sendStatus(200);
  } catch (error) {
    console.error("[MPESA CALLBACK] Error processing callback:", error.message);
    console.error("[MPESA CALLBACK] Stack:", error.stack);
    res.sendStatus(200); // Still acknowledge to prevent Daraja retries
  }
});

/**
 * GET /api/payments/test/mpesa-auth
 * Test endpoint to verify M-Pesa Daraja authentication is working
 * Useful for debugging MPESA_USE_SANDBOX and credential issues
 */
router.get("/test/mpesa-auth", async (req, res) => {
  if (!ensureTestEndpointsEnabled(res)) {
    return;
  }

  try {
    console.log("[TEST] M-Pesa OAuth Test");
    console.log("[TEST] Environment:", {
      NODE_ENV: process.env.NODE_ENV,
      MPESA_USE_SANDBOX: process.env.MPESA_USE_SANDBOX,
      MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY ? "***SET***" : "NOT SET",
      MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET ? "***SET***" : "NOT SET",
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || "NOT SET",
      MPESA_PASSKEY: process.env.MPESA_PASSKEY ? "***SET***" : "NOT SET"
    });

    // Try to get access token
    const token = await mpesaService.getAccessToken();
    
    return res.json({
      success: true,
      message: "M-Pesa OAuth authentication successful!",
      token: token.substring(0, 20) + "...[TRUNCATED]",
      mode: process.env.MPESA_USE_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUCTION',
      timestamp: new Date().toISOString(),
      instruction: "Your M-Pesa credentials are working. You can now proceed with STK push."
    });
  } catch (error) {
    console.error("[TEST] M-Pesa OAuth Test failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "M-Pesa OAuth authentication failed",
      error: error.message,
      debugging: {
        mode: process.env.MPESA_USE_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUCTION',
        NODE_ENV: process.env.NODE_ENV,
        suggestions: [
          "1. Verify MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in .env",
          "2. Verify MPESA_USE_SANDBOX=true (for sandbox) or =false (for production)",
          "3. Ensure credentials match the environment (sandbox creds for sandbox, production creds for production)",
          "4. Check internet connectivity from your server",
          "5. Verify the credentials have not expired"
        ]
      }
    });
  }
});

/**
 * GET /api/payments/test/mpesa-stk
 * Test endpoint to verify complete STK push flow
 * Sends a test STK to a provided phone number
 * Body: { phone, amount } (e.g. { "phone": "254712345678", "amount": 1 })
 */
router.post("/test/mpesa-stk", async (req, res) => {
  if (!ensureTestEndpointsEnabled(res)) {
    return;
  }

  try {
    const { phone, amount = 1 } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: phone (format: 254712345678 or 0712345678)"
      });
    }

    console.log("[TEST] M-Pesa STK Test - Phone:", phone, "Amount:", amount);

    // Initiate test STK push
    const result = await mpesaService.initiateStkPush(
      phone,
      amount,
      `TEST-${Date.now()}`,
      `Test STK Push - Binti Events`
    );

    return res.json({
      success: true,
      message: "STK push initiated successfully! Check your phone for the prompt.",
      mode: process.env.MPESA_USE_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUCTION',
      response: {
        checkoutRequestId: result.checkoutRequestId,
        responsecode: result.responseCode,
        responseDescription: result.responseDescription,
        customerMessage: result.customerMessage,
        merchantRequestId: result.merchantRequestId
      },
      instruction: "A confirmation prompt should appear on the phone: " + phone,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[TEST] M-Pesa STK Test failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "STK push test failed",
      error: error.message,
      debugging: {
        timestamp: new Date().toISOString(),
        suggestions: [
          "1. Verify phone number format (should be 254712345678, not 0712345678 or +254712345678)",
          "2. Check that MPESA_USE_SANDBOX=true is set for sandbox testing",
          "3. Verify all M-Pesa credentials in .env",
          "4. Ensure the phone number has M-Pesa enabled",
          "5. If sandbox: use a test phone or create one on Daraja portal"
        ]
      }
    });
  }
});

/**
 * POST /api/payments/test/simulate-success
 * Simulate a successful M-Pesa payment for testing
 * Sets booking to paid and sends confirmation email
 * Body: { bookingId }
 */
router.post("/test/simulate-success", async (req, res) => {
  if (!ensureTestEndpointsEnabled(res)) {
    return;
  }

  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Missing bookingId" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const fakeReceipt = "SIM_" + Date.now();

    booking.status = 'paid';
    booking.paymentMethod = 'mpesa';
    booking.transactionId = fakeReceipt;
    booking.updatedAt = new Date();
    await booking.save();

    console.log("[TEST] Simulated success for booking:", bookingId);

    // Send WhatsApp notifications
    let whatsappResult = { customer: null, admin: null };
    try {
      const WhatsAppService = require('../services/WhatsAppService');
      const whatsAppService = WhatsAppService();
      const customerWA = await whatsAppService.sendBookingConfirmation(booking);
      whatsappResult.customer = customerWA;
      console.log("[TEST] WhatsApp customer result:", customerWA);
      const adminWA = await whatsAppService.sendAdminAlert(booking);
      whatsappResult.admin = adminWA;
      console.log("[TEST] WhatsApp admin result:", adminWA);
    } catch (waErr) {
      console.error("[TEST] WhatsApp error:", waErr.message);
    }

    // Send confirmation email + invoice
    let emailResult = { success: false, error: "not attempted" };
    let invoiceResult = false;
    try {
      const emailService = getEmailService();
      emailResult = await emailService.sendPaymentConfirmation(booking, fakeReceipt);
      console.log("[TEST] Email result:", emailResult);
    } catch (emailErr) {
      console.error("[TEST] Email error:", emailErr.message);
      emailResult = { success: false, error: emailErr.message };
    }

    try {
      const InvoiceService = require('../services/InvoiceService');
      const invoiceService = new InvoiceService();
      invoiceResult = await invoiceService.sendInvoice(booking);
      console.log("[TEST] Invoice result:", invoiceResult);
      if (invoiceResult) {
        booking.invoiceSent = true;
        booking.invoiceSentAt = new Date();
        await booking.save();
        console.log("[TEST] invoiceSent flag set to true");
      }
    } catch (invoiceErr) {
      console.error("[TEST] Invoice error:", invoiceErr.message);
    }

    return res.json({
      success: true,
      message: "Payment simulated successfully",
      booking: { id: booking._id, status: booking.status, email: booking.email },
      email: emailResult,
      invoice: invoiceResult,
      whatsapp: whatsappResult,
      receipt: fakeReceipt
    });
  } catch (error) {
    console.error("[TEST] Simulation error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/status/:bookingId
 * Check payment status for a booking
 * Returns current booking status: pending, payment_failed, paid, completed
 * 
 * Frontend can poll this endpoint after initiating payment to get real-time updates
 */
router.get("/status/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    console.log("[PAYMENT STATUS] Checking status for booking:", bookingId);

    // Query booking from database
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        bookingId
      });
    }

    console.log("[PAYMENT STATUS] Booking status:", booking.status);

    // Return booking status
    const response = {
      success: true,
      bookingId,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      totalAmount: booking.totalAmount,
      transactionId: booking.transactionId || null,
      timestamp: new Date().toISOString()
    };

    // Include failure details if payment failed
    if (booking.status === 'payment_failed') {
      response.failureReason = booking.paymentFailureReason;
      response.failureCode = booking.paymentFailureCode;
      response.failureExplanation = booking.lastPaymentError;
      
      console.log("[PAYMENT STATUS] Payment failed:", {
        code: booking.paymentFailureCode,
        reason: booking.paymentFailureReason,
        explanation: booking.lastPaymentError
      });
    }

    // Include success details if paid
    if (booking.status === 'paid') {
      console.log("[PAYMENT STATUS] Payment successful");
      response.invoiceSent = booking.invoiceSent;
      response.invoiceSentAt = booking.invoiceSentAt;
    }

    res.json(response);
  } catch (error) {
    console.error("[PAYMENT STATUS] Error checking payment status:", error.message);
    res.status(500).json({
      success: false,
      message: "Error checking payment status",
      error: error.message
    });
  }
});

module.exports = router;
