// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const TransportService = require("../services/TransportService");
const Booking = require("../models/Booking");
const { v4: uuidv4 } = require("uuid");

// Note: EmailService is only imported when confirm endpoint is called (lazy load)

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
      lighting, transport, pasound, dancefloor, stagepodium, welcomesigns, decor, location, sections,
      eventDate, setupTime 
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
    if (transport === "yes" || transport === true) {
      if (!location || typeof location !== "string") {
        return res.status(400).json({ success: false, message: "Location is required to calculate transport cost." });
      }

      const transportCalc = TransportService.calculateTransportCost(location);
      total += transportCalc.transportCost;
      breakdown.transport = {
        cost: transportCalc.transportCost,
        zone: transportCalc.zoneName,
        serviceArea: transportCalc.serviceArea,
        zoneInfo: transportCalc.zoneInfo
      };
    }

    // SITE VISIT: Removed - users now request via contact form
    // (No longer calculated in booking price)

    res.json({ success: true, total, breakdown });
  } catch (err) {
    console.error("❌ CALCULATE ERROR:", {
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
  try {
    const {
      bookingFlow,
      fullname, phone, email, venue,
      tentConfigs,
      packageName, packageBasePrice,
      tentType, tentSize, lighting, transport, decor, pasound, dancefloor, stagepodium, welcomesigns,
      location, sections, termsAccepted, paymentMethod, mpesaPhone,
      eventDate, setupTime, additionalInfo
    } = req.body;

    console.log("✅ /confirm endpoint called with:", {
      fullname,
      phone,
      email,
      venue,
      eventDate,
      setupTime,
      tentType,
      tentSize,
      lighting,
      transport,
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

    // Calculate pricing (supports package, tents, or both)
    let total = 0;
    const breakdown = {};
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
          configCost = 30000;
          tentDetails.push({ type: 'b-line', cost: configCost });
        } 
        else if (config.type === 'cheese') {
          configCost = 15000;
          tentDetails.push({ type: 'cheese', color: config.color || 'white', cost: configCost });
        }
        console.log("Tent configuration added:", config);
        tentTotal += configCost;
      }
      
      total += tentTotal;
      breakdown.tent = { 
        type: 'multi-config', 
        configurations: tentDetails, 
        cost: tentTotal,
        count: tentConfigs.length
      };
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
          return res.status(400).json({ success: false, message: "Invalid stretch tent size format. Use 'widthxheight' e.g. 22x15." });
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
      } else if (tentType === "b-line" || tentType === "bline") {
        const tentCost = 30000;
        total += tentCost;
        breakdown.tent = { type: "b-line", cost: tentCost };
      } else if (tentType === "cheese") {
        const tentCost = 15000;
        total += tentCost;
        breakdown.tent = { type: "cheese", cost: tentCost };
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

    if (lighting === "yes" || lighting === true) {
      total += 12000;
      breakdown.lighting = 12000;
    }

    if (transport === "yes" || transport === true) {
      if (!location || typeof location !== "string") {
        return res.status(400).json({ success: false, message: "Location is required to calculate transport cost." });
      }
      const transportCalc = TransportService.calculateTransportCost(location);
      total += transportCalc.transportCost;
      breakdown.transport = {
        cost: transportCalc.transportCost,
        zone: transportCalc.zoneName,
        serviceArea: transportCalc.serviceArea,
        zoneInfo: transportCalc.zoneInfo
      };
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
      transport: transport === "yes" || transport === true,
      pasound: pasound === "yes" || pasound === true,
      dancefloor: dancefloor === "yes" || dancefloor === true,
      stagepodium: stagepodium === "yes" || stagepodium === true,
      welcomesigns: welcomesigns === "yes" || welcomesigns === true,
      decor: decor === "yes" || decor === true,
      venue,
      location,
      eventDate,
      setupTime,
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

    // Save booking to MongoDB
    await booking.save();
    console.log(`✅ Booking saved to database with ID: ${bookingId}`);

    // Send confirmation emails (non-blocking - don't wait for email before responding)
    // Email failures should not fail the entire booking
    console.log("Booking confirmed:");
    console.log(`   Booking ID: ${bookingId}`);
    console.log(`   Customer: ${fullname}`);
    console.log(`   Total: KES ${total}`);
    console.log(`   Deposit (80%): KES ${Math.round(total * 0.8)}`);
    console.log(`   Sending confirmation emails...`);
    
    // Send emails asynchronously (non-blocking)
    (async () => {
      try {
        const EmailService = require("../services/EmailService");
        const emailService = EmailService();
        const customerEmailResult = await emailService.sendBookingConfirmation(booking);
        const adminEmailResult = await emailService.sendAdminNotification(booking, booking.depositAmount);
        console.log(`   ✅ Customer email sent to ${booking.email}`);
        console.log(`   ✅ Admin email sent to ${process.env.ADMIN_EMAIL}`);
      } catch (emailErr) {
        console.warn('⚠️ Email service unavailable:', emailErr.message);
        console.warn('Booking was created successfully but confirmation emails could not be sent.');
      }
    })();

    // Return booking confirmation immediately (don't wait for emails)
    res.json({
      success: true,
      message: "Booking confirmed! Confirmation emails have been sent.",
      bookingId: booking._id, // Explicitly provide booking ID at top level
      booking: booking.toJSON(),
      depositAmount: booking.depositAmount,
      remainingAmount: booking.remainingAmount,
      emailsSent: {
        customer: "processing",
        admin: "processing"
      }
    });

  } catch (err) {
    console.error("Error confirming booking:", err);
    res.status(500).json({
      success: false,
      message: "Server error confirming booking. Please try again.",
      error: err.message
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
