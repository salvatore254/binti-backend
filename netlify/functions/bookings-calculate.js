/**
 * Netlify Function: POST /api/bookings/calculate
 * Calculates booking costs based on selection
 */

const { withCors, parseBody } = require('./utils');
const TransportService = require('../../services/TransportService');

const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const body = parseBody(event.body);
    const {
      bookingFlow,
      tentConfigs,
      packageName,
      packageBasePrice,
      lighting,
      transport,
      pasound,
      dancefloor,
      stagepodium,
      welcomesigns,
      decor,
      location,
      eventDate,
      setupTime
    } = body;

    console.log('/calculate endpoint called with location:', location);

    let total = 0;
    const breakdown = {};
    let hasPackage = packageBasePrice && packageBasePrice > 0;
    let hasTents = tentConfigs && Array.isArray(tentConfigs) && tentConfigs.length > 0;

    // Validate input
    if (!hasPackage && !hasTents && bookingFlow === 'tent') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Please select either a package or add tent configurations.'
        })
      };
    }

    // Handle Package
    if (hasPackage) {
      total += packageBasePrice;
      breakdown.package = {
        name: packageName || 'Selected Package',
        basePrice: packageBasePrice
      };
    }

    // Handle Tent Configurations
    if (hasTents) {
      let tentTotal = 0;
      const tentDetails = [];

      for (const config of tentConfigs) {
        let configCost = 0;

        if (config.type === 'stretch') {
          if (!config.size) {
            return {
              statusCode: 400,
              body: JSON.stringify({
                success: false,
                message: 'Stretch tent requires size specification.'
              })
            };
          }
          const parts = config.size.split('x').map(p => parseFloat(p));
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            return {
              statusCode: 400,
              body: JSON.stringify({
                success: false,
                message: `Invalid stretch tent size: ${config.size}`
              })
            };
          }
          const area = parts[0] * parts[1];
          configCost = Math.round(area * 250);
          tentDetails.push({ type: 'stretch', size: config.size, area, cost: configCost });
        } else if (config.type === 'aframe' || config.type === 'a-frame') {
          const sections_count = config.sections || 1;
          configCost = 40000 * parseInt(sections_count);
          tentDetails.push({ type: 'a-frame', sections: sections_count, cost: configCost });
        } else if (config.type === 'bline' || config.type === 'b-line') {
          configCost = 30000;
          tentDetails.push({ type: 'b-line', cost: configCost });
        } else if (config.type === 'cheese') {
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
      breakdown.tent = { type: 'package-included', cost: 0 };
    }

    // Add-ons
    if (lighting === 'yes' || lighting === true) {
      total += 12000;
      breakdown.lighting = 12000;
    }

    if (pasound === 'yes' || pasound === true) {
      total += 8000;
      breakdown.pasound = 8000;
    }

    if (dancefloor === 'yes' || dancefloor === true) {
      total += 10000;
      breakdown.dancefloor = 10000;
    }

    if (stagepodium === 'yes' || stagepodium === true) {
      total += 15000;
      breakdown.stagepodium = 15000;
    }

    if (welcomesigns === 'yes' || welcomesigns === true) {
      total += 3000;
      breakdown.welcomesigns = 3000;
    }

    if (decor === 'yes' || decor === true) {
      breakdown.decor = 'Upon Inquiry';
    }

    // Transport calculation
    if (transport === 'yes' || transport === true) {
      if (!location || typeof location !== 'string') {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: 'Location is required to calculate transport cost.'
          })
        };
      }

      try {
        console.log('🔍 Calculating transport for location:', location);

        const transportCalc = TransportService.calculateTransportCost(location);

        console.log('✅ Transport calculation succeeded:', transportCalc);

        total += transportCalc.transportCost;
        breakdown.transport = {
          cost: transportCalc.transportCost,
          zone: transportCalc.zoneName,
          serviceArea: transportCalc.serviceArea,
          zoneInfo: transportCalc.zoneInfo
        };
      } catch (transportErr) {
        console.error('🚨 TransportService crash:', {
          message: transportErr.message,
          stack: transportErr.stack,
          location: location
        });

        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: 'Transport calculation failed: ' + transportErr.message
          })
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, total, breakdown })
    };
  } catch (err) {
    console.error('❌ CALCULATE ERROR:', {
      message: err.message,
      stack: err.stack
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: `Server error calculating booking: ${err.message}`
      })
    };
  }
};

exports.handler = withCors(handler);
