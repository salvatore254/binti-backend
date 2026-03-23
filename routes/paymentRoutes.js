// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const MpesaService = require("../services/MpesaService");
const EmailService = require("../services/EmailService");
const Booking = require("../models/Booking");

// Initialize M-Pesa service (production or sandbox based on NODE_ENV)
const mpesaService = new MpesaService();
const emailService = EmailService; // Already instantiated in EmailService.js

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
 * Body: { amount, email, phone, orderRef }
 * Returns: { success: true, iframe_url }
 */
router.post("/pesapal", async (req, res) => {
  try {
    const { amount, email, phone, orderRef } = req.body;
    // In production: call Pesapal API from server to create an order and return the iframe URL.
    // Here: return a demo/placeholder url using uuid (front-end can embed).
    const fakeIframe = `https://demo.pesapal.com/iframe?orderRef=${encodeURIComponent(orderRef || uuidv4())}&amount=${encodeURIComponent(amount)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`;
    return res.json({ success: true, iframe_url: fakeIframe });
  } catch (err) {
    console.error("Pesapal error:", err);
    return res.status(500).json({ success: false, message: "Failed to create Pesapal checkout." });
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
 * Pesapal will POST to your callback URL. Implement verification and status update logic here.
 */
router.post("/pesapal-callback", (req, res) => {
  console.log("Pesapal callback received:", req.body);
  // TODO: verify signature, update booking status in DB, respond 200.
  res.sendStatus(200);
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
