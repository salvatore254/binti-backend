/**
 * Invoice Service
 * Generates and sends invoices after payment confirmation
 * Matches the exact Binti Events quote PDF format (Screenshot.png)
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
  }

  /**
   * Generate PDF invoice buffer matching the Binti quote template
   */
  generateInvoicePDF(booking) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const gold = [255, 199, 0];       // #FFC700
    const purple = [120, 81, 169];     // #7851A9
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

    // ─── YELLOW LOGO BOX (left) ───
    doc.setFillColor(...gold);
    doc.rect(margin, y, 65, 35, 'F');

    // "Binti" text inside yellow box
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(28);
    doc.setTextColor(150, 50, 120); // dark pink/magenta for "Binti"
    doc.text('Binti', margin + 14, y + 16);

    // "Tents & Events" below
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(150, 50, 120);
    doc.text('Tents & Events', margin + 10, y + 23);

    // "Instinctively Elegant" tagline
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Instinctively Elegant', margin + 13, y + 29);

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

    // Table header (pink/magenta background)
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
    doc.text('Binti', pageWidth - margin, y, { align: 'right' });

    y += 12;

    // ─── THANK YOU footer ───
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(18);
    doc.setTextColor(217, 70, 239); // pink/magenta
    doc.text('thank you', pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...black);
    doc.text('FOR YOUR ORDER', pageWidth / 2, y, { align: 'center' });

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text("Let's get social @bintievents", pageWidth / 2, y, { align: 'center' });

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

      console.log(`[INVOICE] Generating PDF invoice for booking ${booking._id}...`);

      const pdfBuffer = this.generateInvoicePDF(booking);
      const invoiceNo = (booking._id || '').substring(0, 8).toUpperCase();
      const pdfFilename = `Invoice_INV-${invoiceNo}.pdf`;

      console.log(`[INVOICE] PDF generated (${pdfBuffer.length} bytes), sending to ${booking.email}...`);

      await this.emailService.sendEmailWithAttachment({
        to: booking.email,
        subject: `Invoice - Binti Events (INV-${invoiceNo})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#7851A9;">Dear ${booking.fullname || 'Valued Customer'},</h2>
            <p>Thank you for your payment! Your invoice from Binti Events is attached as a PDF.</p>
            <p><strong>Invoice No:</strong> INV-${invoiceNo}<br>
            <strong>Amount:</strong> KES ${(booking.totalAmount || 0).toLocaleString()}<br>
            ${booking.transactionId ? `<strong>Transaction ID:</strong> ${booking.transactionId}<br>` : ''}
            <strong>Venue:</strong> ${booking.venue || 'N/A'}</p>
            <p>For any questions, please contact us:<br>
            📞 ${this.companyInfo.phone} | 📧 ${this.companyInfo.email}</p>
            <p>Best regards,<br><strong>Binti Events Team</strong></p>
          </div>
        `,
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
