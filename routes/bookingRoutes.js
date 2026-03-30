// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const TransportService = require("../services/TransportService");
const EmailService = require("../services/EmailService");
const Booking = require("../models/Booking");
const { v4: uuidv4 } = require("uuid");

// DIAGNOSTIC: Log that routes file loaded successfully
console.log("[BOOKING] Routes loaded successfully");

// Initialize EmailService once at startup to avoid delays on first request
let emailService = null;
try {
  emailService = EmailService(); // Call factory function to get singleton instance
  console.log("[BOOKING] EmailService initialized");
} catch (err) {
  console.warn("[BOOKING] Failed to initialize EmailService:", err.message);
}

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeBoolean = (value) => value === true || value === "yes";

const calculateBookingPricing = (payload) => {
  const {
    tentConfigs,
    packageName,
    packageBasePrice,
    tentType,
    tentSize,
    sections,
    lighting,
    transportArrangement,
    transportVenue,
    decor,
    pasound,
    dancefloor,
    stagepodium,
    welcomesigns,
    location,
    transport,
    highpeakConfig,
  } = payload;

  let total = 0;
  const breakdown = {};
  const hasPackage = Number(packageBasePrice) > 0;
  const hasTentConfigs = Array.isArray(tentConfigs) && tentConfigs.length > 0;
  const hasOldTentType = tentType && tentType !== "none";

  if (!hasPackage && !hasTentConfigs && !hasOldTentType) {
    throw createHttpError("Please select either a package or add tent configurations.");
  }

  if (hasPackage) {
    total += Number(packageBasePrice);
    breakdown.package = {
      name: packageName || "Selected Package",
      basePrice: Number(packageBasePrice),
    };
  }

  if (hasTentConfigs) {
    let tentTotal = 0;
    const tentDetails = [];

    for (const config of tentConfigs) {
      let configCost = 0;

      if (config.type === "stretch") {
        if (!config.size) {
          throw createHttpError("Stretch tent requires size specification.");
        }
        const parts = config.size.split("x").map((part) => parseFloat(part));
        if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
          throw createHttpError(`Invalid stretch tent size: ${config.size}`);
        }
        const area = parts[0] * parts[1];
        configCost = Math.round(area * 250);
        tentDetails.push({ type: "stretch", size: config.size, area, cost: configCost });
      } else if (config.type === "aframe" || config.type === "a-frame") {
        const sectionCount = parseInt(config.sections || 1, 10);
        configCost = 40000 * sectionCount;
        tentDetails.push({ type: "a-frame", sections: sectionCount, cost: configCost });
      } else if (config.type === "bline" || config.type === "b-line") {
        const blineConfig = config.config || "100";
        configCost = blineConfig === "50" ? 30000 : 40000;
        tentDetails.push({ type: "b-line", config: blineConfig, cost: configCost });
      } else if (config.type === "cheese") {
        configCost = 15000;
        tentDetails.push({ type: "cheese", color: config.color || "white", cost: configCost });
      } else if (config.type === "highpeak") {
        const configType = config.config || "100";
        configCost = configType === "50" ? 5000 : 10000;
        tentDetails.push({ type: "highpeak", config: configType, cost: configCost });
      } else if (config.type === "pergola") {
        configCost = 20000;
        tentDetails.push({ type: "pergola", cost: configCost });
      } else {
        throw createHttpError(`Unsupported tent type: ${config.type || "unknown"}`);
      }

      tentTotal += configCost;
    }

    total += tentTotal;
    breakdown.tent = {
      type: "multi-config",
      configurations: tentDetails,
      cost: tentTotal,
      count: tentConfigs.length,
    };
  } else if (hasOldTentType) {
    if (tentType === "stretch") {
      if (!tentSize || typeof tentSize !== "string") {
        throw createHttpError("Missing or invalid tentSize for stretch tent.");
      }
      const parts = tentSize.split("x").map((part) => parseFloat(part));
      if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        throw createHttpError("Invalid stretch tent size format.");
      }
      const area = parts[0] * parts[1];
      const tentCost = Math.round(area * 250);
      total += tentCost;
      breakdown.tent = { type: "stretch", size: tentSize, area, cost: tentCost };
    } else if (tentType === "a-frame" || tentType === "aframe" || tentType === "a_frame") {
      const sectionCount = sections ? parseInt(sections, 10) || 1 : 1;
      const tentCost = 40000 * sectionCount;
      total += tentCost;
      breakdown.tent = { type: "a-frame", sections: sectionCount, cost: tentCost };
    } else if (tentType === "cheese") {
      total += 15000;
      breakdown.tent = { type: "cheese", cost: 15000 };
    } else if (tentType === "pergola") {
      total += 20000;
      breakdown.tent = { type: "pergola", cost: 20000 };
    } else if (tentType === "highpeak" || tentType === "high-peak") {
      const configType = highpeakConfig || "100";
      const tentCost = configType === "50" ? 5000 : 10000;
      total += tentCost;
      breakdown.tent = { type: "high-peak", config: configType, cost: tentCost };
    } else {
      throw createHttpError(`Unsupported tent type: ${tentType}`);
    }
  } else {
    breakdown.tent = { type: "package-included", cost: 0 };
  }

  if (normalizeBoolean(lighting)) {
    total += 12000;
    breakdown.lighting = 12000;
  }

  if (normalizeBoolean(pasound)) {
    total += 8000;
    breakdown.pasound = 8000;
  }

  if (normalizeBoolean(dancefloor)) {
    total += 10000;
    breakdown.dancefloor = 10000;
  }

  if (normalizeBoolean(stagepodium)) {
    total += 15000;
    breakdown.stagepodium = 15000;
  }

  if (normalizeBoolean(welcomesigns)) {
    total += 3000;
    breakdown.welcomesigns = 3000;
  }

  if (normalizeBoolean(decor)) {
    breakdown.decor = "Upon Inquiry";
  }

  if (transportArrangement === "arrange") {
    if (!transportVenue || typeof transportVenue !== "string") {
      throw createHttpError("Transport venue is required when transport arrangement is selected.");
    }

    const transportCalc = TransportService.calculateTransportCost(transportVenue);
    total += transportCalc.transportCost;
    breakdown.transport = {
      cost: transportCalc.transportCost,
      zone: transportCalc.zoneName,
      serviceArea: transportCalc.serviceArea,
      zoneInfo: transportCalc.zoneInfo,
    };
  } else if (normalizeBoolean(transport)) {
    if (!location || typeof location !== "string") {
      throw createHttpError("Location is required when transport is selected.");
    }

    const transportCalc = TransportService.calculateTransportCost(location);
    total += transportCalc.transportCost;
    breakdown.transport = {
      cost: transportCalc.transportCost,
      zone: transportCalc.zoneName,
      serviceArea: transportCalc.serviceArea,
      zoneInfo: transportCalc.zoneInfo,
    };
  } else {
    breakdown.transport = { cost: 0, arrangement: "own" };
  }

  return { total, breakdown };
};

/**
 * POST /api/bookings/calculate
 * Handles two booking flows:
 * 1. Package Flow: User selects a pre-designed package
 * 2. Tent Flow: User selects individual tents with custom configurations
 */
router.post("/calculate", (req, res) => {
  try {
    console.log("/calculate endpoint called with location:", req.body.location);
    const { total, breakdown } = calculateBookingPricing(req.body);
    res.json({ success: true, total, breakdown });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error("[CALCULATE] ERROR:", {
      message: err.message,
      stack: err.stack,
      location: req.body.location,
      transport: req.body.transport
    });
    res.status(statusCode).json({ 
      success: false, 
      message: `Server error calculating booking: ${err.message}`,
      error: err.message 
    });
  }
});

/**
 * GET /api/bookings/zones
 * Returns all available zones (Nairobi + Outside Nairobi) for frontend reference
 */
router.get("/zones", (req, res) => {
  try {
    const nairobiZones = TransportService.getAllZones();
    const outsideNairobiZones = TransportService.getOutsideNairobiZones();

    res.json({
      success: true,
      nairobiZones,
      outsideNairobiZones
    });
  } catch (err) {
    console.error("Error fetching zones:", err);
    res.status(500).json({ success: false, message: "Server error fetching zones." });
  }
});

/**
 * POST /api/bookings/identify-zone
 * Body: { location }
 * Returns zone info and transport cost for a given location
 * Useful for frontend to show real-time zone identification
 */
router.post("/identify-zone", (req, res) => {
  try {
    const { location } = req.body;
    if (!location || typeof location !== "string") {
      return res.status(400).json({ success: false, message: "Location is required." });
    }

    const transportCalc = TransportService.calculateTransportCost(location);
    res.json({
      success: true,
      location,
      ...transportCalc
    });
  } catch (err) {
    console.error("Error identifying zone:", err);
    res.status(500).json({ success: false, message: "Server error identifying zone." });
  }
});

/**
 * POST /api/bookings/confirm
 * Confirm a booking with terms acceptance and send confirmation emails
 * 
 * Body: {
 *   fullname, phone, email, venue,
 *   tentType, tentSize, lighting, transport, decor, pasound, dancefloor, stagepodium, welcomesigns,
 *   location (for transport calculation),
 *   sections (for a-frame),
 *   termsAccepted (boolean), paymentMethod (mpesa/pesapal)
 * }
 * 
 * Returns: { success: true, booking: {...}, depositAmount: ..., message: "..." }
 */
router.post("/confirm", async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      bookingFlow,
      fullname, phone, email, venue,
      tentConfigs,
      packageName, packageBasePrice,
      tentType, tentSize, lighting, transportArrangement, transportVenue, decor, pasound, dancefloor, stagepodium, welcomesigns,
      location, sections, termsAccepted, paymentMethod, mpesaPhone,
      setupTime, eventDate, additionalInfo
    } = req.body;

    console.log("[CONFIRM] Endpoint called with:", {
      fullname,
      phone,
      email,
      venue,
      setupTime,
      tentType,
      tentSize,
      lighting,
      transportArrangement,
      transportVenue,
      decor,
      pasound,
      dancefloor,
      stagepodium,
      welcomesigns,
      location,
      sections,
      termsAccepted,
      paymentMethod,
      mpesaPhone,
      additionalInfo
    });

    // Validate required fields
    const hasPackage = packageBasePrice && packageBasePrice > 0;
    const hasTentConfig = tentConfigs && Array.isArray(tentConfigs) && tentConfigs.length > 0;
    const hasOldTentType = tentType && tentType !== 'none';
    
    if (!fullname || !phone || !email || !venue) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (fullname, phone, email, venue)."
      });
    }
    
    // Must have either package or tent configuration (or both)
    if (!hasPackage && !hasTentConfig && !hasOldTentType) {
      return res.status(400).json({
        success: false,
        message: "Please select either a package or add tent configurations."
      });
    }

    // Validate terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "You must accept the Terms and Conditions to proceed with booking."
      });
    }

    const { total, breakdown } = calculateBookingPricing(req.body);

    if (req.body.totalAmount !== undefined && Number(req.body.totalAmount) !== total) {
      return res.status(400).json({
        success: false,
        message: "Booking total mismatch. Please recalculate your booking before confirming.",
      });
    }

    // SITE VISIT: Removed - users now request via contact form
    // (No longer calculated in booking price)

    // Create booking object
    const bookingId = uuidv4();
    const booking = new Booking({
      id: bookingId,
      fullname,
      phone,
      mpesaPhone,
      email,
      tentConfigs,
      tentType,
      tentSize,
      sections,
      aframeSections: sections,
      lighting: lighting === "yes" || lighting === true,
      transportArrangement: transportArrangement || 'own',
      transportVenue: transportVenue || '',
      pasound: pasound === "yes" || pasound === true,
      dancefloor: dancefloor === "yes" || dancefloor === true,
      stagepodium: stagepodium === "yes" || stagepodium === true,
      welcomesigns: welcomesigns === "yes" || welcomesigns === true,
      decor: decor === "yes" || decor === true,
      venue,
      location,
      setupTime,
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      packageName,
      packageBasePrice,
      additionalInfo,
      totalAmount: total,
      breakdown,
      status: "pending",
      paymentMethod: paymentMethod || "mpesa",
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Save booking to MongoDB BEFORE responding
    try {
      await booking.save();
      console.log(`[BOOKING] Saved to database with ID: ${bookingId}`);
    } catch (dbErr) {
      console.error('[BOOKING] Failed to save to database:', dbErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to save booking. Please try again.",
        error: dbErr.message
      });
    }

    const responseTime = Date.now() - startTime;
    console.log(`[CONFIRM] Responding (took ${responseTime}ms)`);
    
    // Calculate deposit and remaining amounts for response
    const depositAmount = Math.round(total * 0.8);
    const remainingAmount = Math.round(total * 0.2);
    
    res.json({
      success: true,
      message: "Booking confirmed. Confirmation will be sent to your email.",
      bookingId: booking._id || bookingId,
      booking: booking.toJSON(),
      depositAmount: depositAmount,
      remainingAmount: remainingAmount,
      status: "processing",
      responseTime: `${responseTime}ms`
    });

    // Send confirmation emails (non-blocking)
    if (emailService) {
      (async () => {
        try {
          const customerEmailResult = await emailService.sendBookingConfirmation(booking);
          const adminEmailResult = await emailService.sendAdminNotification(booking, booking.depositAmount);
          console.log(`[EMAIL] Customer confirmation sent to ${booking.email}`);
          console.log(`[EMAIL] Admin notification sent to ${process.env.ADMIN_EMAIL}`);
        } catch (emailErr) {
          console.warn('[EMAIL] Service unavailable:', emailErr.message);
          console.warn('Booking was created successfully but confirmation emails could not be sent.');
        }
      })();
    } else {
      console.warn('[EMAIL] EmailService not available - emails will not be sent');
    }

  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error(`[CONFIRM] Error after ${errorTime}ms:`, err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({
      success: false,
      message: "Server error confirming booking. Please try again.",
      error: err.message,
      responseTime: `${errorTime}ms`
    });
  }
});

/**
 * GET /api/bookings/payment-status/:bookingId
 * Fetch payment status of a booking
 * Used by frontend to poll for payment confirmation after STK/Pesapal initiated
 */
router.get("/payment-status/:bookingId", async (req, res) => {
  const startTime = Date.now();
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    // Fetch booking by ID
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        status: 'not_found'
      });
    }

    // Return payment status
    const queryTime = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      status: booking.status, // 'pending', 'paid', 'payment_failed', 'completed', 'cancelled'
      bookingId: booking._id,
      paymentMethod: booking.paymentMethod,
      transactionId: booking.transactionId,
      responseTime: `${queryTime}ms`
    });

  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error("[PAYMENT-STATUS ERROR]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching payment status",
      error: err.message,
      responseTime: `${errorTime}ms`
    });
  }
});

/**
 * GET /api/bookings/pesapal-iframe
 * Fetch booking data and initialize Pesapal payment
 * Returns the Pesapal iframe URL for displaying the payment form
 */
router.get("/pesapal-iframe", async (req, res) => {
  try {
    const { bookingId } = req.query;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    // Fetch the booking from database
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    console.log(`[BOOKING] Fetched booking for Pesapal iframe: ${bookingId}`);
    console.log(`[BOOKING] Booking details:`, {
      fullname: booking.fullname,
      email: booking.email,
      totalAmount: booking.totalAmount,
      depositAmount: booking.depositAmount
    });

    // Initialize Pesapal payment with booking details
    const { v4: uuidv4 } = require("uuid");
    const orderRef = `ORDER_${bookingId}_${uuidv4().substr(0, 8)}`;

    // Initialize payment service
    const useMockPesapal = process.env.USE_PESAPAL_MOCK === 'true';
    const PesapalService = useMockPesapal 
      ? require("../services/PesapalServiceMock")
      : require("../services/PesapalService");
    
    const pesapalService = new PesapalService();

    // Create payment order
    const paymentResult = await pesapalService.createOrder({
      amount: booking.depositAmount, // Use deposit amount (80%)
      currency: 'KES',
      orderRef: orderRef,
      description: `Binti Events Booking - ${booking.fullname}`,
      email: booking.email,
      phone: booking.phone,
      firstName: booking.fullname.split(' ')[0] || 'Customer',
      lastName: booking.fullname.split(' ').slice(1).join(' ') || 'Name'
    });

    await Booking.findByIdAndUpdate(bookingId, {
      paymentMethod: 'pesapal',
      pesapalOrderRef: orderRef,
      pesapalOrderTrackingId: paymentResult.orderTrackingId,
      updatedAt: new Date(),
    });

    console.log(`[BOOKING] Pesapal order created:`, {
      orderRef,
      orderTrackingId: paymentResult.orderTrackingId,
      iframeUrl: paymentResult.iframe_url?.substring(0, 50) + '...'
    });

    // Return iframe data to frontend
    res.json({
      success: true,
      iframe_url: paymentResult.iframe_url,
      orderTrackingId: paymentResult.orderTrackingId,
      orderRef: orderRef,
      booking: {
        id: booking._id,
        fullname: booking.fullname,
        email: booking.email,
        totalAmount: booking.totalAmount,
        depositAmount: booking.depositAmount,
        remainingAmount: booking.remainingAmount
      }
    });

  } catch (error) {
    console.error("[BOOKING] Error initializing Pesapal iframe:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to initialize Pesapal payment"
    });
  }
});

module.exports = router;
