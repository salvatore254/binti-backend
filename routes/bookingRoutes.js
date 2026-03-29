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

/**
 * POST /api/bookings/calculate
 * Handles two booking flows:
 * 1. Package Flow: User selects a pre-designed package
 * 2. Tent Flow: User selects individual tents with custom configurations
 */
router.post("/calculate", (req, res) => {
  try {
    const { 
      bookingFlow, 
      tentConfigs, 
      packageName, 
      packageBasePrice,
      lighting, transportArrangement, transportVenue, pasound, dancefloor, stagepodium, welcomesigns, decor, location, sections,
      setupTime, eventDate
    } = req.body;

    console.log("/calculate endpoint called with location:", location);

    let total = 0;
    const breakdown = {};
    let hasPackage = packageBasePrice && packageBasePrice > 0;
    let hasTents = tentConfigs && Array.isArray(tentConfigs) && tentConfigs.length > 0;

    // If neither package nor tents provided and it's explicitly tent flow, error
    if (!hasPackage && !hasTents && bookingFlow === 'tent') {
      return res.status(400).json({ success: false, message: "Please select either a package or add tent configurations." });
    }

    // Handle Package (if provided)
    if (hasPackage) {
      total += packageBasePrice;
      breakdown.package = { 
        name: packageName || 'Selected Package', 
        basePrice: packageBasePrice 
      };
    }

    // Handle Tent Configurations (if provided - can be combined with package)
    if (hasTents) {
      let tentTotal = 0;
      const tentDetails = [];
      
      for (const config of tentConfigs) {
        let configCost = 0;
        
        if (config.type === 'stretch') {
          if (!config.size) {
            return res.status(400).json({ success: false, message: "Stretch tent requires size specification." });
          }
          const parts = config.size.split('x').map(p => parseFloat(p));
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            return res.status(400).json({ success: false, message: `Invalid stretch tent size: ${config.size}` });
          }
          const area = parts[0] * parts[1];
          configCost = Math.round(area * 250);
          tentDetails.push({ type: 'stretch', size: config.size, area, cost: configCost });
        } 
        else if (config.type === 'aframe' || config.type === 'a-frame') {
          const sections_count = config.sections || 1;
          configCost = 40000 * parseInt(sections_count);
          tentDetails.push({ type: 'a-frame', sections: sections_count, cost: configCost });
        } 
        else if (config.type === 'bline' || config.type === 'b-line') {
          configCost = 30000;
          tentDetails.push({ type: 'b-line', cost: configCost });
        } 
        else if (config.type === 'cheese') {
          configCost = 15000;
          tentDetails.push({ type: 'cheese', color: config.color || 'white', cost: configCost });
        }
        else if (config.type === 'highpeak') {
          const config_type = config.config || '100'; // default to 100 seater
          configCost = config_type === '50' ? 5000 : 10000;
          tentDetails.push({ type: 'highpeak', config: config_type, cost: configCost });
        }
        else if (config.type === 'pergola') {
          configCost = 20000;
          tentDetails.push({ type: 'pergola', cost: configCost });
        }
        else if (config.type === 'bline') {
          const bline_config = config.config || '100'; // default to 100 guest
          configCost = bline_config === '50' ? 30000 : 40000;
          tentDetails.push({ type: 'b-line', config: bline_config, cost: configCost });
        }
        
        tentTotal += configCost;
      }
      
      total += tentTotal;
      breakdown.tent = { 
        type: 'multi-config', 
        configurations: tentDetails, 
        cost: tentTotal,
        count: tentConfigs.length
      };
    } else if (hasPackage) {
      // Package only, no tents
      breakdown.tent = { type: 'package-included', cost: 0 };
    }

    if (lighting === "yes" || lighting === true) {
      total += 12000;
      breakdown.lighting = 12000;
    }

    // Add-ons pricing
    if (pasound === "yes" || pasound === true) {
      total += 8000;
      breakdown.pasound = 8000;
    }

    if (dancefloor === "yes" || dancefloor === true) {
      total += 10000;
      breakdown.dancefloor = 10000;
    }

    if (stagepodium === "yes" || stagepodium === true) {
      total += 15000;
      breakdown.stagepodium = 15000;
    }

    if (welcomesigns === "yes" || welcomesigns === true) {
      total += 3000;
      breakdown.welcomesigns = 3000;
    }

    if (decor === "yes" || decor === true) {
      breakdown.decor = "Upon Inquiry";
    }

    // TRANSPORT: Use TransportService for dynamic calculation
    if (transportArrangement === 'arrange' && transportVenue) {
      if (!transportVenue || typeof transportVenue !== "string") {
        return res.status(400).json({ success: false, message: "Transport venue is required when transport arrangement is selected." });
      }

      try {
        console.log("🔍 Calculating transport for location:", transportVenue);
        
        const transportCalc = TransportService.calculateTransportCost(transportVenue);
        
        console.log("[TRANSPORT] Calculation succeeded:", transportCalc);

        total += transportCalc.transportCost;
        breakdown.transport = {
          cost: transportCalc.transportCost,
          zone: transportCalc.zoneName,
          serviceArea: transportCalc.serviceArea,
          zoneInfo: transportCalc.zoneInfo
        };
      } catch (transportErr) {
        console.error(" TransportService crash:", {
          message: transportErr.message,
          stack: transportErr.stack,
          location: transportVenue
        });

        return res.status(500).json({
          success: false,
          message: "Transport calculation failed: " + transportErr.message
        });
      }
    } else {
      // No transport arrangement, cost is 0
      breakdown.transport = { cost: 0, arrangement: 'own' };
    }

    // SITE VISIT: Removed - users now request via contact form
    // (No longer calculated in booking price)

    res.json({ success: true, total, breakdown });
  } catch (err) {
    console.error("[CALCULATE] ERROR:", {
      message: err.message,
      stack: err.stack,
      location: req.body.location,
      transport: req.body.transport
    });
    res.status(500).json({ 
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

    // PERFORMANCE OPTIMIZATION: Use pre-calculated totalAmount if provided by frontend
    // (Frontend should have already called /calculate endpoint)
    // If totalAmount is provided, skip expensive recalculation
    let total = req.body.totalAmount || 0;
    let breakdown = req.body.breakdown || {};
    let skipCalculation = total > 0; // Use provided values if totalAmount included

    // If totalAmount not provided, calculate it (backward compatibility, slower)
    if (!skipCalculation) {
      console.log('[CONFIRM] totalAmount not provided - fallback to calculation');
      let hasTentConfigs = tentConfigs && Array.isArray(tentConfigs) && tentConfigs.length > 0;
      let hasOldTentFormat = tentType && (tentType !== 'none');
      
      // If using new multi-config system
      if (hasTentConfigs) {
        // Add package if provided
        if (hasPackage) {
          total += packageBasePrice;
          breakdown.package = { 
            name: packageName || 'Selected Package', 
            basePrice: packageBasePrice 
          };
        }
        
        // Calculate all tent configurations
        let tentTotal = 0;
        const tentDetails = [];
        
        for (const config of tentConfigs) {
          let configCost = 0;
          
          if (config.type === 'stretch') {
            if (!config.size) {
              return res.status(400).json({ success: false, message: "Stretch tent requires size specification." });
            }
            const parts = config.size.split('x').map(p => parseFloat(p));
            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
              return res.status(400).json({ success: false, message: `Invalid stretch tent size: ${config.size}` });
            }
            const area = parts[0] * parts[1];
            configCost = Math.round(area * 250);
            tentDetails.push({ type: 'stretch', size: config.size, area, cost: configCost });
          } 
          else if (config.type === 'aframe' || config.type === 'a-frame') {
            const sectionCount = config.sections || 1;
            configCost = 40000 * parseInt(sectionCount);
            tentDetails.push({ type: 'a-frame', sections: sectionCount, cost: configCost });
          } 
          else if (config.type === 'bline' || config.type === 'b-line') {
            const bline_config = config.config || '100'; // default to 100 guest
            configCost = bline_config === '50' ? 30000 : 40000;
            tentDetails.push({ type: 'b-line', config: bline_config, cost: configCost });
          } 
          else if (config.type === 'cheese') {
            configCost = 15000;
            tentDetails.push({ type: 'cheese', color: config.color || 'white', cost: configCost });
          }
          else if (config.type === 'highpeak') {
            const config_type = config.config || '100'; // default to 100 seater
            configCost = config_type === '50' ? 5000 : 10000;
            tentDetails.push({ type: 'highpeak', config: config_type, cost: configCost });
          }
          else if (config.type === 'pergola') {
            configCost = 20000;
            tentDetails.push({ type: 'pergola', cost: configCost });
          }
          tentTotal += configCost;
        }
        
        if (tentTotal > 0) {
          total += tentTotal;
          breakdown.tent = { 
            type: 'multi-config', 
            configurations: tentDetails, 
            cost: tentTotal,
            count: tentConfigs.length
          };
        }
      } 
      // Fallback to old single-tent format (for backward compatibility)
      else if (hasOldTentFormat) {
        // Add package if provided
        if (hasPackage) {
          total += packageBasePrice;
          breakdown.package = { 
            name: packageName || 'Selected Package', 
            basePrice: packageBasePrice 
          };
        }
        
        // Calculate single tent
        if (tentType === "stretch") {
          if (!tentSize || typeof tentSize !== "string") {
            return res.status(400).json({ success: false, message: "Missing or invalid tentSize for stretch tent." });
          }
          const parts = tentSize.split("x").map(p => parseFloat(p));
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            return res.status(400).json({ success: false, message: "Invalid stretch tent size format." });
          }
          const area = parts[0] * parts[1];
          const tentCost = Math.round(area * 250);
          total += tentCost;
          breakdown.tent = { type: "stretch", size: tentSize, area: area, cost: tentCost };
        } else if (tentType === "a-frame" || tentType === "aframe" || tentType === "a_frame") {
          const sectionCount = sections ? parseInt(sections, 10) || 1 : 1;
          const tentCost = 40000 * sectionCount;
          total += tentCost;
          breakdown.tent = { type: "a-frame", sections: sectionCount, cost: tentCost };
        } else if (tentType === "cheese") {
          const tentCost = 15000;
          total += tentCost;
          breakdown.tent = { type: "cheese", cost: tentCost };
        } else if (tentType === "pergola") {
          const tentCost = 20000;
          total += tentCost;
          breakdown.tent = { type: "pergola", cost: tentCost };
        } else if (tentType === "highpeak" || tentType === "high-peak") {
          const config_type = req.body.highpeakConfig || '100';
          const tentCost = config_type === '50' ? 5000 : 10000;
          total += tentCost;
          breakdown.tent = { type: "high-peak", config: config_type, cost: tentCost };
        }
      } 
      // Package only
      else if (hasPackage) {
        total += packageBasePrice;
        breakdown.package = { 
          name: packageName || 'Selected Package', 
          basePrice: packageBasePrice 
        };
        breakdown.tent = { type: "package-included", cost: 0 };
      } 
      // Neither package nor tents provided - error
      else {
        return res.status(400).json({
          success: false,
          message: "Please select either a package or add tent configurations."
        });
      }

      // Add lighting if provided
      if (lighting === "yes" || lighting === true) {
        total += 12000;
        breakdown.lighting = 12000;
      }

      // Add add-ons
      if (pasound === "yes" || pasound === true) {
        total += 8000;
        breakdown.pasound = 8000;
      }
      if (dancefloor === "yes" || dancefloor === true) {
        total += 10000;
        breakdown.dancefloor = 10000;
      }
      if (stagepodium === "yes" || stagepodium === true) {
        total += 15000;
        breakdown.stagepodium = 15000;
      }
      if (welcomesigns === "yes" || welcomesigns === true) {
        total += 3000;
        breakdown.welcomesigns = 3000;
      }
      if (decor === "yes" || decor === true) {
        breakdown.decor = "Upon Inquiry";
      }

      // OLD format transport (legacy)
      const transport = req.body.transport;
      if (transport === "yes" || transport === true) {
        if (location && typeof location === "string") {
          const transportCalc = TransportService.calculateTransportCost(location);
          total += transportCalc.transportCost;
          breakdown.transport = {
            cost: transportCalc.transportCost,
            zone: transportCalc.zoneName,
            serviceArea: transportCalc.serviceArea,
            zoneInfo: transportCalc.zoneInfo
          };
        }
      }
    }

    // Ensure transport is set if arranged (even if totalAmount was provided)
    if (transportArrangement === 'arrange' && transportVenue && !breakdown.transport) {
      try {
        const transportCalc = TransportService.calculateTransportCost(transportVenue);
        breakdown.transport = {
          cost: transportCalc.transportCost,
          zone: transportCalc.zoneName,
          serviceArea: transportCalc.serviceArea,
          zoneInfo: transportCalc.zoneInfo
        };
        total += transportCalc.transportCost;
      } catch (transportErr) {
        console.error('[CONFIRM] Transport calculation failed:', transportErr.message);
        return res.status(500).json({
          success: false,
          message: "Transport calculation failed: " + transportErr.message
        });
      }
    } else if (!breakdown.transport) {
      breakdown.transport = { cost: 0, arrangement: 'own' };
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

    // Return booking confirmation BEFORE saving to database (non-blocking)
    // This ensures quick frontend response (< 1 second)
    const responseTime = Date.now() - startTime;
    console.log(`[CONFIRM] Responding (took ${responseTime}ms)`);
    
    // Calculate deposit and remaining amounts (before save) for response
    const depositAmount = Math.round(total * 0.8);
    const remainingAmount = Math.round(total * 0.2);
    
    res.json({
      success: true,
      message: "Booking processing started. Confirmation will be sent to your email.",
      bookingId: booking._id || bookingId,
      booking: booking.toJSON(),
      depositAmount: depositAmount,
      remainingAmount: remainingAmount,
      status: "processing",
      responseTime: `${responseTime}ms`
    });

    // Save booking to MongoDB asynchronously (non-blocking - don't wait before responding)
    // Database save happens in background after response is sent
    (async () => {
      try {
        await booking.save();
        console.log(`[BOOKING] Saved to database with ID: ${bookingId}`);
      } catch (dbErr) {
        console.error('[BOOKING] Failed to save to database:', dbErr.message);
      }
    })();

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
