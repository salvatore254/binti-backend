/**
 * Invoice Service
 * Generates and sends invoices after payment confirmation
 * Matches the exact Binti Events quote PDF format
 * Uses jsPDF for lightweight PDF generation (no Puppeteer)
 */

const EmailService = require('./EmailService');
const logger = require('../utils/logger');
const { jsPDF } = require('jspdf');

class InvoiceService {
  constructor() {
    this.emailService = EmailService();
    this.companyInfo = {
      name: 'Binti Events',
      address: 'Karen',
      city: 'Nairobi',
      country: 'Kenya',
      phone: '0728307327',
      email: 'bintievents@gmail.com',
      website: 'www.bintievents.com',
    };
    this.logoUrl = 'https://bintievents.vercel.app/images/invoicelogo.jpg';
    this._logoBase64 = null;
  }

  /**
   * Fetch the logo image and return as base64 data URI
   */
  async _loadLogo() {
    if (this._logoBase64) return this._logoBase64;
    try {
      const response = await fetch(this.logoUrl);
      if (!response.ok) throw new Error(`Logo fetch failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      this._logoBase64 = Buffer.from(arrayBuffer).toString('base64');
      console.log('[INVOICE] Logo loaded successfully');
      return this._logoBase64;
    } catch (err) {
      console.warn('[INVOICE] Could not load logo:', err.message);
      return null;
    }
  }

  /**
   * Generate PDF invoice buffer matching the Binti quote template
   */
  async generateInvoicePDF(booking) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const pink = [255, 192, 250];      // #FFC0FA - table header
    const black = [51, 51, 51];        // #333333
    const gray = [102, 102, 102];      // #666666
    const lightGray = [200, 200, 200]; // borders

    // Date formatting
    const invoiceDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    });
    const eventDate = booking.eventDate
      ? new Date(booking.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';

    const invoiceNo = (booking._id || '').substring(0, 8).toUpperCase();
    const items = this.generateInvoiceItems(booking);

    let y = margin;

    // ─── LOGO (left) ───
    const logoBase64 = await this._loadLogo();
    if (logoBase64) {
      try {
        doc.addImage('data:image/png;base64,' + logoBase64, 'PNG', margin, y, 45, 20);
      } catch (err) {
        console.warn('[INVOICE] Could not embed logo image:', err.message);
        // Fallback: text logo
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(22);
        doc.setTextColor(150, 50, 120);
        doc.text('Binti Events', margin, y + 14);
      }
    } else {
      // Fallback: text logo
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(22);
      doc.setTextColor(150, 50, 120);
      doc.text('Binti Events', margin, y + 14);
    }

    // ─── "INVOICE" title (right) ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...black);
    doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });

    // ─── Company info (right-aligned) ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    doc.text('Binti Events', pageWidth - margin, y + 16, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(this.companyInfo.address, pageWidth - margin, y + 21, { align: 'right' });
    doc.text(this.companyInfo.city, pageWidth - margin, y + 25, { align: 'right' });
    doc.text(this.companyInfo.country, pageWidth - margin, y + 29, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('Customer Care', pageWidth - margin, y + 35, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(this.companyInfo.phone, pageWidth - margin, y + 39, { align: 'right' });
    doc.text(this.companyInfo.email, pageWidth - margin, y + 43, { align: 'right' });
    doc.text(this.companyInfo.website, pageWidth - margin, y + 47, { align: 'right' });

    y += 58;

    // ─── FOR section (client) + Invoice details ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text('FOR', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(booking.fullname || 'N/A', margin, y + 6);
    doc.text(booking.venue || '', margin, y + 11);
    doc.text(booking.location || 'Kenya', margin, y + 16);

    // Invoice No, Issue date, Payment Status (right side)
    const labelX = pageWidth - margin - 55;
    const valueX = pageWidth - margin;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('Invoice No.:', labelX, y, { align: 'right' });
    doc.text('Issue date:', labelX, y + 6, { align: 'right' });
    doc.text('Payment:', labelX, y + 12, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text('INV-' + invoiceNo, valueX, y, { align: 'right' });
    doc.text(invoiceDate, valueX, y + 6, { align: 'right' });

    // "PAID" in green
    doc.setTextColor(76, 175, 80);
    doc.text('PAID', valueX, y + 12, { align: 'right' });

    y += 24;

    // ─── Event date & venue ───
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    doc.text(`Event date : ${eventDate}`, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(booking.venue || '', margin, y);

    if (booking.transactionId) {
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text(`Transaction ID: ${booking.transactionId}`, margin, y + 5);
      y += 10;
    } else {
      y += 5;
    }

    y += 5;

    // ─── ITEMS TABLE ───
    const colWidths = [contentWidth * 0.42, contentWidth * 0.16, contentWidth * 0.21, contentWidth * 0.21];
    const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];

    // Table header (pink background)
    doc.setFillColor(...pink);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...black);
    doc.text('DESCRIPTION', colX[0] + 2, y + 5.5);
    doc.text('QUANTITY', colX[1] + colWidths[1] / 2, y + 5.5, { align: 'center' });
    doc.text('UNIT PRICE (KSH)', colX[2] + colWidths[2] - 2, y + 5.5, { align: 'right' });
    doc.text('AMOUNT (KSH)', colX[3] + colWidths[3] - 2, y + 5.5, { align: 'right' });

    y += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...black);

    items.forEach(item => {
      // Row border
      doc.setDrawColor(...lightGray);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);

      doc.text(item.description, colX[0] + 2, y + 5);
      doc.text(String(item.quantity), colX[1] + colWidths[1] / 2, y + 5, { align: 'center' });
      doc.text(this.formatAmount(item.unitPrice), colX[2] + colWidths[2] - 2, y + 5, { align: 'right' });
      doc.text(this.formatAmount(item.amount), colX[3] + colWidths[3] - 2, y + 5, { align: 'right' });

      y += 8;
    });

    // Bottom border of table
    doc.setDrawColor(...lightGray);
    doc.line(margin, y, margin + contentWidth, y);

    y += 5;

    // ─── TOTAL row ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text('TOTAL (KES):', colX[2] + colWidths[2] - 2, y + 2, { align: 'right' });
    doc.text('KSh' + this.formatAmount(booking.totalAmount), colX[3] + colWidths[3] - 2, y + 2, { align: 'right' });

    y += 4;

    // Deposit info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    const depositPaid = Math.round(booking.totalAmount * 0.8);
    const balanceDue = booking.totalAmount - depositPaid;
    doc.text(`Deposit Paid (80%): KES ${depositPaid.toLocaleString()}   |   Balance Due (20%): KES ${balanceDue.toLocaleString()}`, margin, y + 4);

    y += 14;

    // ─── TERMS & CONDITIONS ───
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8);
    doc.setTextColor(...black);
    doc.text('Terms & conditions apply:', margin, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);

    const terms = [
      'Client by signing of the contract & making payment authorizes Binti Tents & Events to supply the above facilities',
      'Payment of at least 80% confirms your booking upon signing below; balance to be upon set up',
      'Cancellation policy: Cancellation must be in writing. A month before event: 50% refund, 2 weeks before: 25% refund; Less than a week: non refundable',
      'Client agrees to safeguard the equipment and be solely responsible for any loss or damage of the same that may occur during period of hire',
      'Quote valid for 30 days',
    ];

    terms.forEach((term, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${term}`, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 3.5;
    });

    y += 8;

    // ─── ISSUED BY ───
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    doc.text('Issued by:', pageWidth - margin, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Binti Events', pageWidth - margin, y, { align: 'right' });

    y += 14;

    // ─── THANK YOU section ───
    // Pink decorative "thank you" with heart
    doc.setTextColor(255, 130, 171); // pink
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(22);
    doc.text('thank you', pageWidth / 2, y, { align: 'center' });

    // Heart symbol above the "y"
    doc.setFontSize(10);
    doc.setTextColor(255, 80, 120); // deeper pink for hearts
    doc.text('\u2665', pageWidth / 2 + 18, y - 8, { align: 'center' });
    doc.setFontSize(7);
    doc.text('\u2665', pageWidth / 2 + 24, y - 5, { align: 'center' });

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('FOR YOUR ORDER', pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text("Let's get social @bintievents", pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(7);
    doc.setTextColor(120, 81, 169); // purple for links
    const socialY = y;
    const socialLinks = [
      { label: 'Instagram', url: 'https://www.instagram.com/bintievents/' },
      { label: 'Facebook', url: 'https://www.facebook.com/bintievents/' },
      { label: 'TikTok', url: 'https://www.tiktok.com/@bintievents' },
    ];
    const socialSpacing = 35;
    const socialStartX = pageWidth / 2 - socialSpacing;
    socialLinks.forEach((link, i) => {
      const x = socialStartX + i * socialSpacing;
      doc.textWithLink(link.label, x, socialY, { url: link.url, align: 'center' });
    });

    // Return as Buffer
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }

  /**
   * Format number as amount string: "1,000.00"
   */
  formatAmount(value) {
    return Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2 });
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
      const bd = booking.breakdown;

      // Package base price
      if (bd.package && bd.package.basePrice > 0) {
        items.push({
          description: `${bd.package.name || 'Event'} Package`,
          quantity: 1,
          unitPrice: bd.package.basePrice,
          amount: bd.package.basePrice,
        });
      }

      // Individual tent configurations from breakdown
      if (bd.tent && bd.tent.configurations && Array.isArray(bd.tent.configurations)) {
        bd.tent.configurations.forEach(t => {
          const name = this.getTentDisplayName(t);
          items.push({
            description: name,
            quantity: 1,
            unitPrice: t.cost || 0,
            amount: t.cost || 0,
          });
        });
      } else if (bd.tent && bd.tent.cost > 0) {
        // Single tent entry
        const name = this.getTentDisplayName(bd.tent);
        items.push({
          description: name,
          quantity: 1,
          unitPrice: bd.tent.cost,
          amount: bd.tent.cost,
        });
      }

      // Add-ons from breakdown (numeric values)
      const addOnKeys = ['lighting', 'pasound', 'dancefloor', 'stagepodium', 'welcomesigns', 'decor', 'electrician', 'speaker', 'stage', 'signage', 'sitevisit'];
      for (const [key, value] of Object.entries(bd)) {
        if (key === 'package' || key === 'tent' || key === 'transport') continue;
        if (typeof value === 'number' && value > 0) {
          items.push({
            description: this.getItemDescription(key),
            quantity: 1,
            unitPrice: value,
            amount: value,
          });
        }
      }

      // Transport
      if (bd.transport && typeof bd.transport === 'object' && bd.transport.cost > 0) {
        items.push({
          description: `Transport${bd.transport.zone ? ' (' + bd.transport.zone + ')' : ''}`,
          quantity: 1,
          unitPrice: bd.transport.cost,
          amount: bd.transport.cost,
        });
      } else if (typeof bd.transport === 'number' && bd.transport > 0) {
        items.push({
          description: 'Transport',
          quantity: 1,
          unitPrice: bd.transport,
          amount: bd.transport,
        });
      }
    }

    // Fallback: generate from tentConfigs and add-ons if breakdown didn't produce items
    if (items.length === 0) {
      if (booking.tentConfigs && booking.tentConfigs.length > 0) {
        booking.tentConfigs.forEach(tent => {
          const name = this.getTentDisplayName(tent);
          items.push({
            description: name,
            quantity: tent.quantity || 1,
            unitPrice: 0,
            amount: 0,
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
  /**
   * Get tent display name from a tent config object
   */
  getTentDisplayName(tent) {
    const type = tent.tentType || tent.type || 'Tent';
    const typeNames = {
      'stretch': 'Stretch Tent',
      'aframe': 'A-Frame Tent',
      'a-frame': 'A-Frame Tent',
      'cheese': 'Cheese Tent',
      'bline': 'B-Line Tent',
      'b-line': 'B-Line Tent',
      'highpeak': 'High Peak Tent',
      'high-peak': 'High Peak Tent',
      'multi-config': 'Tent Setup',
      'marquee': 'Marquee Tent',
      'bell': 'Bell Tent',
      'pergola': 'Pergola Tent',
    };
    let name = typeNames[type] || (type.charAt(0).toUpperCase() + type.slice(1) + ' Tent');
    const size = tent.tentSize || tent.size;
    if (size) name += ` (${size})`;
    if (tent.sections) name += ` (${tent.sections} section${tent.sections > 1 ? 's' : ''})`;
    if (tent.config) name += ` (${tent.config} ${type.includes('high') ? 'Seater' : 'Guest'})`;
    if (tent.color) name += ` - ${tent.color}`;
    return name;
  }

  getItemDescription(key) {
    const descriptions = {
      tent: 'Tent Setup',
      lighting: 'Lighting - fashion strings',
      transport: 'Transport',
      electrician: 'Electrician fee',
      speaker: 'PA Sound System',
      pasound: 'PA Sound System',
      dancefloor: 'Dance Floor',
      stage: 'Stage / Podium',
      stagepodium: 'Stage / Podium',
      signage: 'Welcome Signs',
      welcomesigns: 'Welcome Signs',
      sitevisit: 'Site Visit & Consultation',
      decor: 'Event Decoration',
    };
    return descriptions[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Send invoice to customer as a PDF attachment
   */
  async sendInvoice(booking) {
    try {
      if (!booking || booking.status !== 'paid') {
        throw new Error('Booking must have paid status to send invoice');
      }
      if (!booking.email) {
        throw new Error('Booking must have email address to send invoice');
      }
      if (booking.invoiceSent === true) {
        console.log(`[INVOICE] Invoice already sent for booking ${booking._id}, skipping`);
        return false;
      }

      console.log(`[INVOICE] Generating PDF invoice for booking ${booking._id}...`);

      const pdfBuffer = await this.generateInvoicePDF(booking);
      const invoiceNo = (booking._id || '').substring(0, 8).toUpperCase();
      const pdfFilename = `Invoice_INV-${invoiceNo}.pdf`;

      console.log(`[INVOICE] PDF generated (${pdfBuffer.length} bytes), sending to ${booking.email}...`);

      await this.emailService.sendEmailWithAttachment({
        to: booking.email,
        subject: `Invoice - Binti Events (INV-${invoiceNo})`,
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding:25px 30px;border-bottom:3px solid #FFC0FA;"><img src="https://bintievents.vercel.app/images/logo1.png" alt="Binti Events" width="120" style="display:block;max-width:120px;height:auto;"></td></tr><tr><td style="padding:25px 30px;"><p style="font-size:15px;margin:0 0 6px 0;">Dear <strong>${booking.fullname || 'Valued Customer'}</strong>,</p><p style="font-size:13px;color:#666;margin:0 0 18px 0;">Thank you for your payment. Your invoice from Binti Events is attached as a PDF.</p><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:18px;"><tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Invoice No</td><td style="padding:8px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">INV-${invoiceNo}</td></tr><tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Amount</td><td style="padding:8px 0;color:#4CAF50;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right;">KES ${(booking.totalAmount || 0).toLocaleString()}</td></tr>${booking.transactionId ? `<tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Transaction ID</td><td style="padding:8px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.transactionId}</td></tr>` : ''}<tr><td style="padding:8px 0;color:#666;">Venue</td><td style="padding:8px 0;color:#333;font-weight:600;text-align:right;">${booking.venue || 'N/A'}</td></tr></table><p style="font-size:13px;color:#666;margin:0 0 6px 0;">For any questions, please contact us:</p><p style="font-size:13px;color:#333;margin:0;">${this.companyInfo.phone} | ${this.companyInfo.email}</p></td></tr><tr><td style="background:#fafafa;border-top:2px solid #FFC0FA;padding:20px 30px;text-align:center;"><p style="font-size:12px;color:#666;margin:0 0 8px 0;"><strong style="color:#333;">Binti Events</strong></p><p style="font-size:11px;color:#999;margin:0;"><a href="https://www.instagram.com/bintievents/" style="color:#7851A9;text-decoration:none;">Instagram</a> &nbsp; <a href="https://www.facebook.com/bintievents/" style="color:#7851A9;text-decoration:none;">Facebook</a> &nbsp; <a href="https://www.tiktok.com/@bintievents" style="color:#7851A9;text-decoration:none;">TikTok</a></p></td></tr></table></td></tr></table></body></html>`,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
        }],
      });

      console.log(`[INVOICE] PDF Invoice sent successfully to ${booking.email}`);
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
