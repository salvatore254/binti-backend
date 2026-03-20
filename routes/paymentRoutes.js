// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

/**
 * NOTE: The following endpoints are scaffolds / placeholders.
 * - Pesapal: you should replace placeholder logic with actual Pesapal auth + order creation (server-side).
 * - Mpesa: you should implement proper Daraja OAuth and STK push with your credentials and environment (sandbox/production URLs).
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
 * Body: { phone, amount, accountRef }
 * Returns: { success: true, message, data? }
 *
 * Note: This is a placeholder. Implement Daraja OAuth and STK push here.
 */
router.post("/mpesa", async (req, res) => {
  try {
    const { phone, amount, accountRef } = req.body;
    // Placeholder response:
    return res.json({ success: true, message: `STK push request (placeholder) sent to ${phone} for KES ${amount}.` });
  } catch (err) {
    console.error("Mpesa error:", err);
    return res.status(500).json({ success: false, message: "Mpesa STK push failed." });
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
 */
router.post("/mpesa-callback", (req, res) => {
  console.log("Mpesa callback received:", req.body);
  // TODO: validate and update booking/payment status
  res.sendStatus(200);
});

module.exports = router;
