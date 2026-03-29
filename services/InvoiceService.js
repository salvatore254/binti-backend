/**
 * Invoice Service
 * Generates and sends invoices after payment confirmation
 * Based on the Binti Events invoice template/quote format
 * Sends invoice as a styled HTML email (no Puppeteer required)
 */

const EmailService = require('./EmailService');
const logger = require('../utils/logger');

class InvoiceService {
  constructor() {
    this.emailService = EmailService();
    this.companyInfo = {
      name: 'Binti Events',
      address: 'Nairobi, Kenya',
      phone: '+254702424242',
      email: 'bintievents@gmail.com',
      website: 'www.bintievents.com',
    };
  }

  /**
   * Generate invoice HTML based on booking details
   * @param {Object} booking - The booking document from MongoDB
   * @returns {String} - HTML invoice content
   */
  /**
   * Generate email-safe invoice HTML (table-based layout for email clients)
   */
  generateInvoiceHTML(booking) {
    const invoiceDate = new Date().toLocaleDateString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\//g, '/');

    const eventDate = new Date(booking.eventDate).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const invoiceItems = this.generateInvoiceItems(booking);
    const itemsHTML = invoiceItems.map(item => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #ddd;text-align:left;">${item.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ddd;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ddd;text-align:right;">KES ${item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">KES ${item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const depositPaid = Math.round(booking.totalAmount * 0.8);
    const balanceDue = booking.totalAmount - depositPaid;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Invoice - Binti Events</title></head><body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#333;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
  <!-- Gold Banner -->
  <tr><td style="background:linear-gradient(135deg,#FFC700,#FFB700);height:8px;"></td></tr>
  
  <!-- Header -->
  <tr><td style="padding:30px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <h2 style="color:#7851A9;margin:0 0 8px 0;font-size:22px;">🎪 Binti Events</h2>
          <p style="font-size:11px;color:#666;margin:2px 0;">${this.companyInfo.address}</p>
          <p style="font-size:11px;color:#666;margin:2px 0;">📞 ${this.companyInfo.phone}</p>
          <p style="font-size:11px;color:#666;margin:2px 0;">📧 ${this.companyInfo.email}</p>
          <p style="font-size:11px;color:#666;margin:2px 0;">🌐 ${this.companyInfo.website}</p>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <h1 style="font-size:36px;color:#7851A9;margin:0 0 10px 0;letter-spacing:2px;">INVOICE</h1>
          <p style="font-size:13px;margin:4px 0;"><strong style="color:#7851A9;">Invoice No:</strong> INV-${(booking._id || '').substring(0, 8).toUpperCase()}</p>
          <p style="font-size:13px;margin:4px 0;"><strong style="color:#7851A9;">Date:</strong> ${invoiceDate}</p>
          <p style="font-size:13px;margin:4px 0;"><strong style="color:#7851A9;">Status:</strong> <span style="color:#4CAF50;font-weight:bold;">PAID ✓</span></p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:2px solid #f0f0f0;margin:0;"></td></tr>

  <!-- Client & Event Details -->
  <tr><td style="padding:20px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;width:50%;">
          <p style="font-size:11px;font-weight:bold;color:#7851A9;margin:0 0 8px 0;text-transform:uppercase;">Bill To</p>
          <p style="font-size:14px;font-weight:bold;margin:3px 0;">${booking.fullname}</p>
          <p style="font-size:13px;color:#555;margin:3px 0;">${booking.venue || ''}</p>
          <p style="font-size:13px;color:#555;margin:3px 0;">${booking.location || 'Kenya'}</p>
          <p style="font-size:13px;color:#555;margin:3px 0;">📧 ${booking.email}</p>
          <p style="font-size:13px;color:#555;margin:3px 0;">📞 ${booking.phone}</p>
        </td>
        <td style="vertical-align:top;width:50%;text-align:right;">
          <p style="font-size:11px;font-weight:bold;color:#7851A9;margin:0 0 8px 0;text-transform:uppercase;">Event Details</p>
          <p style="font-size:13px;margin:3px 0;"><strong>Event Date:</strong> ${eventDate}</p>
          <p style="font-size:13px;margin:3px 0;"><strong>Setup Time:</strong> ${booking.setupTime || 'N/A'}</p>
          ${booking.transactionId ? `<p style="font-size:13px;margin:3px 0;"><strong>Transaction ID:</strong><br><code style="font-size:12px;background:#f5f0ff;padding:2px 6px;border-radius:3px;">${booking.transactionId}</code></p>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Payment Status Badge -->
  <tr><td style="padding:0 40px;">
    <div style="background:#e8f5e9;color:#2e7d32;padding:12px;border-radius:4px;text-align:center;font-weight:bold;font-size:14px;border-left:5px solid #4CAF50;">
      ✓ PAYMENT CONFIRMED ${booking.transactionId ? '— Transaction: ' + booking.transactionId : ''}
    </div>
  </td></tr>

  <!-- Items Table -->
  <tr><td style="padding:20px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f5f0ff;">
          <th style="padding:12px;text-align:left;font-weight:bold;border-bottom:2px solid #7851A9;color:#7851A9;">DESCRIPTION</th>
          <th style="padding:12px;text-align:center;font-weight:bold;border-bottom:2px solid #7851A9;color:#7851A9;">QTY</th>
          <th style="padding:12px;text-align:right;font-weight:bold;border-bottom:2px solid #7851A9;color:#7851A9;">UNIT PRICE</th>
          <th style="padding:12px;text-align:right;font-weight:bold;border-bottom:2px solid #7851A9;color:#7851A9;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>
  </td></tr>

  <!-- Totals -->
  <tr><td style="padding:0 40px 20px;">
    <table width="300" cellpadding="0" cellspacing="0" style="margin-left:auto;border:2px solid #7851A9;border-radius:6px;background:#faf8ff;">
      <tr>
        <td style="padding:10px 15px;font-size:13px;color:#555;">Deposit Paid (80%)</td>
        <td style="padding:10px 15px;font-size:13px;text-align:right;font-weight:bold;color:#4CAF50;">KES ${depositPaid.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:10px 15px;font-size:13px;color:#555;">Balance Due (20%)</td>
        <td style="padding:10px 15px;font-size:13px;text-align:right;font-weight:bold;color:#e65100;">KES ${balanceDue.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="2" style="border-top:2px solid #7851A9;padding:12px 15px;">
          <table width="100%"><tr>
            <td style="font-size:16px;font-weight:bold;color:#7851A9;">TOTAL</td>
            <td style="font-size:16px;font-weight:bold;color:#7851A9;text-align:right;">KES ${booking.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
          </tr></table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Terms & Conditions -->
  <tr><td style="padding:0 40px;">
    <hr style="border:none;border-top:2px solid #f0f0f0;margin:0 0 15px 0;">
    <p style="font-size:11px;font-weight:bold;color:#7851A9;margin:0 0 8px 0;text-transform:uppercase;">Terms &amp; Conditions</p>
    <ol style="font-size:11px;color:#666;line-height:1.8;margin:0;padding-left:20px;">
      <li>By signing this contract, the client authorizes Binti Events to supply the above facilities as agreed.</li>
      <li>Binti Events is responsible for all equipment provided during the event period.</li>
      <li>Cancellation Policy: A month before event: 50% refund | 2 weeks: 25% refund | Less than a week: No refund.</li>
      <li>All payments must be received before the event setup begins.</li>
    </ol>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:30px 40px;border-top:2px solid #FFB700;margin-top:30px;text-align:center;background:#faf8ff;">
    <p style="font-size:20px;color:#7851A9;font-style:italic;font-weight:bold;margin:0 0 5px 0;">Thank You ❤️</p>
    <p style="font-size:12px;color:#666;margin:0 0 10px 0;">FOR YOUR ORDER</p>
    <p style="font-size:12px;color:#666;margin:0;">
      <strong>Binti Events</strong><br>
      📞 0702 424 242 &nbsp;|&nbsp; 📧 bintievents@gmail.com<br>
      🌐 www.bintievents.com
    </p>
    <p style="font-size:10px;color:#999;margin:12px 0 0 0;">
      Invoice generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
      © ${new Date().getFullYear()} Binti Events. All rights reserved.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  }

  /**
   * Generate line items from booking breakdown
   * @param {Object} booking - The booking document
   * @returns {Array} - Array of invoice items
   */
  generateInvoiceItems(booking) {
    const items = [];

    // Parse the breakdown object to generate items
    if (booking.breakdown && typeof booking.breakdown === 'object') {
      for (const [key, value] of Object.entries(booking.breakdown)) {
        if (value > 0) {
          const description = this.getItemDescription(key);
          items.push({
            description,
            quantity: 1,
            unitPrice: value,
            amount: value,
          });
        }
      }
    }

    // If no breakdown, generate from tentConfigs and add-ons
    if (items.length === 0) {
      if (booking.tentConfigs && booking.tentConfigs.length > 0) {
        booking.tentConfigs.forEach(tent => {
          items.push({
            description: `${tent.tentType} tent${tent.size ? ` (${tent.size})` : ''}`,
            quantity: tent.quantity || 1,
            unitPrice: 20000, // Default, should come from breakdown
            amount: (tent.quantity || 1) * 20000,
          });
        });
      }

      // Add optional add-ons
      const addOns = [
        { key: 'lighting', description: 'Lighting - fashion strings', price: 14000 },
        { key: 'transport', description: 'Transport', price: 7000 },
        { key: 'pasound', description: 'PA Sound System', price: 5000 },
        { key: 'dancefloor', description: 'Dance Floor', price: 8000 },
        { key: 'stagepodium', description: 'Stage / Podium', price: 6000 },
        { key: 'welcomesigns', description: 'Welcome Signs', price: 2000 },
        { key: 'siteVisit', description: 'Site Visit & Consultation', price: 5000 },
        { key: 'decor', description: 'Event Decoration', price: 10000 },
      ];

      addOns.forEach(addOn => {
        if (booking[addOn.key]) {
          items.push({
            description: addOn.description,
            quantity: 1,
            unitPrice: addOn.price,
            amount: addOn.price,
          });
        }
      });
    }

    // Ensure at least some items
    if (items.length === 0) {
      items.push({
        description: 'Event Services Package',
        quantity: 1,
        unitPrice: booking.totalAmount,
        amount: booking.totalAmount,
      });
    }

    return items;
  }

  /**
   * Convert breakdown keys to human-readable descriptions
   * @param {String} key - The breakdown key
   * @returns {String} - Description
   */
  getItemDescription(key) {
    const descriptions = {
      tent: 'Stretch tent',
      lighting: 'Lighting - fashion strings',
      transport: 'Transport',
      electrician: 'Electrician fee',
      speaker: 'PA Sound System',
      dancefloor: 'Dance Floor',
      stage: 'Stage / Podium',
      signage: 'Welcome Signs',
      sitevisit: 'Site Visit & Consultation',
      decor: 'Event Decoration',
    };
    return descriptions[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Send invoice to customer as an HTML email
   */
  async sendInvoice(booking) {
    try {
      if (!booking || booking.status !== 'paid') {
        throw new Error('Booking must have paid status to send invoice');
      }
      if (!booking.email) {
        throw new Error('Booking must have email address to send invoice');
      }

      console.log(`[INVOICE] Generating invoice for booking ${booking._id}...`);

      const invoiceHTML = this.generateInvoiceHTML(booking);

      await this.emailService.sendEmailWithHTML({
        to: booking.email,
        subject: `Invoice - Binti Events (Booking #${(booking._id || '').substring(0, 8).toUpperCase()})`,
        html: invoiceHTML,
      });

      console.log(`[INVOICE] Invoice sent successfully to ${booking.email}`);
      return true;
    } catch (error) {
      console.error('[INVOICE] Failed to send invoice:', error.message);
      logger.error(`Invoice sending failed for booking ${booking._id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check for paid bookings without invoices and send them
   * Call this periodically (e.g., every 5 minutes) via a scheduler
   * @param {Function} Booking - Mongoose Booking model
   */
  async processPendingInvoices(Booking) {
    try {
      console.log('[INVOICE] Checking for pending invoices...');

      // Find bookings that are paid but haven't had invoices sent yet
      // (OR add an `invoiceSent` flag to Booking model for better tracking)
      const paidBookings = await Booking.find({
        status: 'paid',
        invoiceSent: { $ne: true }, // Only if not sent yet
      });

      if (paidBookings.length === 0) {
        console.log('[INVOICE] No pending invoices to process');
        return;
      }

      console.log(`[INVOICE] Processing ${paidBookings.length} pending invoices...`);

      for (const booking of paidBookings) {
        const success = await this.sendInvoice(booking);
        
        if (success) {
          // Mark invoice as sent
          await Booking.findByIdAndUpdate(booking._id, { invoiceSent: true });
        }
      }
    } catch (error) {
      console.error('[INVOICE] Error processing pending invoices:', error.message);
      logger.error(`Pending invoices processing failed: ${error.message}`);
    }
  }
}

module.exports = InvoiceService;
