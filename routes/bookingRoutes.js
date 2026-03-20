// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const TransportService = require("../services/TransportService");

/**
 * POST /api/bookings/calculate
 * Body: { tentType, tentSize, lighting, transport, siteVisit, location }
 * Returns: { success: true, total, breakdown: {...} }
 * 
 * Now includes dynamic transport cost calculation based on location
 */
router.post("/calculate", (req, res) => {
  try {
    const { tentType, tentSize, lighting, transport, siteVisit, location, sections } = req.body;

    let total = 0;
    const breakdown = {};

    // Pricing rules:
    // - Stretch tents: 250 KES per m^2 (if size supplied as "22x15", calculate area)
    // - A-frame: 40,000 per section (front-end sends sections or tentType 'a-frame' implies 1)
    // - B-line: 30,000 fixed
    // - Cheese tent: 15,000 fixed
    // - Lighting: 20,000
    // - Transport: Dynamic based on location (Nairobi zones or outside Nairobi)
    // - Site visit (Nairobi): 1,500

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
      total += 20000;
      breakdown.lighting = 20000;
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

    // SITE VISIT
    if (siteVisit === "yes" || siteVisit === true) {
      if (!location || typeof location !== "string") {
        return res.status(400).json({ success: false, message: "Location is required to calculate site visit cost." });
      }

      // Check if location is in Nairobi
      const isNairobiLocation = !TransportService.isOutsideNairobi(location);
      if (isNairobiLocation) {
        total += 1500;
        breakdown.siteVisit = { cost: 1500, area: "Nairobi" };
      } else {
        // Outside Nairobi site visits require arrangements
        breakdown.siteVisit = { cost: 0, note: "Outside Nairobi - requires arrangements (will contact customer)" };
      }
    }

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

module.exports = router;
