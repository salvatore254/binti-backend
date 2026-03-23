// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const TransportService = require("../services/TransportService");
const Booking = require("../models/Booking");
const EmailService = require("../services/EmailService");
const { v4: uuidv4 } = require("uuid");

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

    console.log("📊 /calculate endpoint called:", {
      bookingFlow,
      packageName,
      packageBasePrice,
      tentConfigsCount: tentConfigs ? tentConfigs.length : 0,
      lighting,
      transport,
      location,
      eventDate,
      setupTime
    });

    let total = 0;
    const breakdown = {};

    // Handle Package Flow
    if (bookingFlow === 'package') {
      if (!packageBasePrice) {
        return res.status(400).json({ success: false, message: "Invalid package pricing information." });
      }
      
      total = packageBasePrice;
      breakdown.package = { 
        name: packageName || 'Selected Package', 
        basePrice: packageBasePrice 
      };
      breakdown.tent = { 
        type: 'package', 
        cost: 0 // Included in package base price
      };
      
      console.log("✅ Package flow - Base price:", packageBasePrice);
    } 
    // Handle Tent Flow
    else if (bookingFlow === 'tent' || !bookingFlow) {
      if (!tentConfigs || !Array.isArray(tentConfigs) || tentConfigs.length === 0) {
        return res.status(400).json({ success: false, message: "At least one tent configuration is required." });
      }

      // Calculate tent pricing for each configuration
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
      
      console.log("✅ Tent flow - Total tent cost:", tentTotal, "Configs:", tentDetails.length);
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
    console.error("Error calculating booking:", err);
    res.status(500).json({ success: false, message: "Server error calculating booking." });
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
      eventDate, setupTime
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
      mpesaPhone
    });

    // Validate required fields
    if (!fullname || !phone || !email || !venue || !tentType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (fullname, phone, email, venue, tentType)."
      });
    }

    // Validate terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "You must accept the Terms and Conditions to proceed with booking."
      });
    }

    // Calculate pricing (same logic as /calculate endpoint)
    let total = 0;
    const breakdown = {};

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
      tentType,
      tentSize,
      lighting: lighting === "yes" || lighting === true,
      transport: transport === "yes" || transport === true,
      pasound: pasound === "yes" || pasound === true,
      dancefloor: dancefloor === "yes" || dancefloor === true,
      stagepodium: stagepodium === "yes" || stagepodium === true,
      welcomesigns: welcomesigns === "yes" || welcomesigns === true,
      decor: decor === "yes" || decor === true,
      venue,
      eventDate,
      setupTime,
      totalAmount: total,
      breakdown,
      status: "pending",
      paymentMethod: paymentMethod || "mpesa",
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Send confirmation emails
    const customerEmailResult = await EmailService.sendBookingConfirmation(booking);
    const adminEmailResult = await EmailService.sendAdminNotification(booking, booking.depositAmount);

    console.log("✅ Booking confirmed:");
    console.log(`   Booking ID: ${bookingId}`);
    console.log(`   Customer: ${fullname}`);
    console.log(`   Total: KES ${total}`);
    console.log(`   Deposit (80%): KES ${booking.depositAmount}`);
    console.log(`   Customer email sent: ${customerEmailResult.success}`);
    console.log(`   Admin email sent: ${adminEmailResult.success}`);

    // Return booking confirmation
    res.json({
      success: true,
      message: "Booking confirmed! Confirmation emails have been sent.",
      booking: booking.toJSON(),
      depositAmount: booking.depositAmount,
      remainingAmount: booking.remainingAmount,
      emailsSent: {
        customer: customerEmailResult.success,
        admin: adminEmailResult.success
      }
    });

  } catch (err) {
    console.error("❌ Error confirming booking:", err);
    res.status(500).json({
      success: false,
      message: "Server error confirming booking. Please try again.",
      error: err.message
    });
  }
});

module.exports = router;
