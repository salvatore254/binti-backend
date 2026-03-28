/**
 * Invoice Service
 * Generates and sends invoices after payment confirmation
 * Based on the Binti Events invoice template/quote format
 * Invoices are sent as PDF attachments
 */

const EmailService = require('./EmailService');
const logger = require('../utils/logger');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class InvoiceService {
  constructor() {
    this.emailService = EmailService();
    this.companyInfo = {
      name: 'Binti Events',
      address: 'Nairobi, Kenya',
      phone: '+254702424242',
      email: 'bintievents@gmail.com',
      website: 'www.bintievents.com',
      logo: 'https://bintievents.vercel.app/logo.png', // Update with actual logo URL
    };
  }

  /**
   * Generate invoice HTML based on booking details
   * @param {Object} booking - The booking document from MongoDB
   * @returns {String} - HTML invoice content
   */
  generateInvoiceHTML(booking) {
    const invoiceDate = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '/');

    const eventDate = new Date(booking.eventDate).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate invoice items from booking breakdown
    const invoiceItems = this.generateInvoiceItems(booking);
    const itemsHTML = invoiceItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice - Binti Events</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            background-color: #f9f9f9;
            padding: 20px;
          }
          
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
          }
          
          .logo-section {
            flex: 1;
          }
          
          .logo-section h2 {
            color: #9c27b0;
            margin-bottom: 10px;
            font-size: 24px;
          }
          
          .invoice-title {
            flex: 1;
            text-align: right;
          }
          
          .invoice-title h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 10px;
          }
          
          .invoice-details {
            flex: 1;
            text-align: right;
            font-size: 14px;
            line-height: 1.8;
          }
          
          .invoice-details p {
            margin: 5px 0;
          }
          
          .invoice-details strong {
            color: #9c27b0;
          }
          
          .company-info {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
          }
          
          .company-info p {
            margin: 3px 0;
          }
          
          .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #9c27b0;
            margin-top: 5px;
          }
          
          .customer-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            font-size: 14px;
          }
          
          .customer-details {
            flex: 1;
          }
          
          .customer-details p {
            margin: 5px 0;
          }
          
          .event-details {
            flex: 1;
            text-align: right;
          }
          
          .event-details p {
            margin: 5px 0;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            font-size: 14px;
          }
          
          .items-table thead {
            background: linear-gradient(135deg, #ffc0fa 0%, #e0b0ff 100%);
            color: #333;
          }
          
          .items-table thead th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid #9c27b0;
          }
          
          .items-table tbody tr:hover {
            background-color: #f5f5f5;
          }
          
          .items-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
          }
          
          .items-table .text-right {
            text-align: right;
          }
          
          .items-table .text-center {
            text-align: center;
          }
          
          .total-section {
            display: flex;
            justify-content: flex-end;
            margin: 20px 0;
            font-size: 14px;
          }
          
          .total-box {
            width: 300px;
            border: 2px solid #9c27b0;
            border-radius: 4px;
            padding: 15px;
            background: #fafafa;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          
          .total-row.grand-total {
            font-size: 18px;
            font-weight: bold;
            color: #9c27b0;
            border-top: 2px solid #9c27b0;
            padding-top: 10px;
            margin-bottom: 0;
          }
          
          .terms-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
          }
          
          .terms-section h3 {
            font-size: 12px;
            font-weight: bold;
            color: #9c27b0;
            margin-bottom: 10px;
          }
          
          .terms-section ol {
            font-size: 11px;
            color: #666;
            margin-left: 20px;
            line-height: 1.8;
          }
          
          .terms-section li {
            margin-bottom: 8px;
          }
          
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            font-size: 12px;
          }
          
          .issued-by {
            flex: 1;
          }
          
          .issued-by p {
            margin: 5px 0;
          }
          
          .thank-you {
            flex: 1;
            text-align: center;
            color: #9c27b0;
            font-style: italic;
          }
          
          .thank-you h3 {
            font-size: 20px;
            margin-bottom: 5px;
          }
          
          .social-icons {
            text-align: center;
            margin-top: 5px;
            font-size: 12px;
          }
          
          .payment-status {
            background: #c8e6c9;
            color: #2e7d32;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
            margin: 20px 0;
            font-size: 14px;
          }

          @media print {
            body {
              background: white;
            }
            .container {
              box-shadow: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <h2> Binti Events</h2>
              <div class="company-info">
                <p>${this.companyInfo.address}</p>
                <p class="section-title">Customer Care</p>
                <p>${this.companyInfo.phone}</p>
                <p>${this.companyInfo.email}</p>
                <p>${this.companyInfo.website}</p>
              </div>
            </div>
            
            <div class="invoice-title">
              <h1>INVOICE</h1>
            </div>
            
            <div class="invoice-details">
              <p><strong>Invoice No:</strong> ${booking._id.substring(0, 8).toUpperCase()}</p>
              <p><strong>Issue date:</strong> ${invoiceDate}</p>
              <p><strong>Payment Status:</strong> <span style="color: #4caf50; font-weight: bold;">PAID</span></p>
            </div>
          </div>

          <!-- Client Details -->
          <div class="customer-section">
            <div class="customer-details">
              <p><strong>FOR</strong></p>
              <p>${booking.fullname}</p>
              <p>${booking.venue}</p>
              <p>${booking.location || 'Kenya'}</p>
            </div>
            
            <div class="event-details">
              <p><strong>Event date:</strong> ${eventDate}</p>
              <p><strong>Setup time:</strong> ${booking.setupTime}</p>
              <p><strong>Phone:</strong> ${booking.phone}</p>
              <p><strong>Email:</strong> ${booking.email}</p>
            </div>
          </div>

          <!-- Payment Status Badge -->
          <div class="payment-status">
            PAYMENT CONFIRMED - Transaction ID: ${booking.transactionId}
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th class="text-center">QUANTITY</th>
                <th class="text-right">UNIT PRICE (KSH)</th>
                <th class="text-right">AMOUNT (KSH)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <!-- Total Section -->
          <div class="total-section">
            <div class="total-box">
              <div class="total-row grand-total">
                <span>TOTAL (KES):</span>
                <span>${booking.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <!-- Terms & Conditions -->
          <div class="terms-section">
            <h3>TERMS & CONDITIONS</h3>
            <ol>
              <li>By signing this contract, the client authorizes Binti Events to supply the above facilities as agreed.</li>
              <li>Binti Events is responsible for all equipment provided during the event period.</li>
              <li>Cancellation Policy: Cancellation must be in writing.
                <ul style="margin-top: 5px; margin-left: 20px;">
                  <li>A month before event: 50% refund</li>
                  <li>2 weeks before event: 25% refund</li>
                  <li>Less than a week: No refund</li>
                </ul>
              </li>
              <li>Binti Events safeguards all equipment and is solely responsible for any loss or damage during the hire period.</li>
              <li>All payments must be received before the event setup begins.</li>
            </ol>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="issued-by">
              <p><strong>Issued by:</strong></p>
              <p style="margin-top: 30px;">Binti Events Team</p>
              <p style="font-size: 10px; color: #999; margin-top: 20px;">
                Invoice generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
              </p>
            </div>
            
            <div class="thank-you">
              <h3 style="font-family: cursive; color: #d946ef;">Thank You</h3>
              <p>FOR YOUR ORDER</p>
              <div class="social-icons">
                <p>📱 0702 424 242 | 📧 bintievents@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
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
   * Convert HTML invoice to PDF
   * @param {String} html - HTML invoice content
   * @param {String} bookingId - Booking ID for filename
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generateInvoicePDF(html, bookingId) {
    let browser = null;
    try {
      console.log(`[INVOICE] Converting invoice to PDF...`);
      
      // Launch browser for PDF generation
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Set content and wait for all resources to load
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF with professional formatting
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        printBackground: true,
        scale: 1,
      });

      console.log(`[INVOICE] PDF generated successfully (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error) {
      console.error('[INVOICE] PDF generation failed:', error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Send invoice to customer via email as PDF attachment
   * @param {Object} booking - The booking document with payment confirmation
   * @returns {Promise<Boolean>} - Success status
   */
  async sendInvoice(booking) {
    let pdfBuffer = null;
    
    try {
      if (!booking || booking.status !== 'paid') {
        throw new Error('Booking must have paid status to send invoice');
      }

      if (!booking.email) {
        throw new Error('Booking must have email address to send invoice');
      }

      console.log(`[INVOICE] Generating invoice for booking ${booking._id}...`);

      // Generate invoice HTML
      const invoiceHTML = this.generateInvoiceHTML(booking);

      // Convert HTML to PDF
      pdfBuffer = await this.generateInvoicePDF(invoiceHTML, booking._id);

      // Prepare email
      const emailSubject = `Invoice - Binti Events (Booking #${booking._id.substring(0, 8).toUpperCase()})`;
      
      const emailBody = `
        <h2>Dear ${booking.fullname},</h2>
        <p>Thank you for your payment! Your invoice for the Binti Events booking is attached as a PDF.</p>
        <p><strong>Event Details:</strong></p>
        <ul>
          <li>Venue: ${booking.venue}</li>
          <li>Location: ${booking.location}</li>
          <li>Event Date: ${new Date(booking.eventDate).toLocaleDateString()}</li>
          <li>Total Amount Paid: KES ${booking.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</li>
          <li>Transaction ID: ${booking.transactionId}</li>
        </ul>
        <p>For any questions, please contact us:</p>
        <p>
          📧 ${this.companyInfo.email}<br>
          📱 ${this.companyInfo.phone}<br>
          🌐 ${this.companyInfo.website}
        </p>
        <p>Best regards,<br><strong>Binti Events Team</strong></p>
      `;

      // Send email with PDF attachment
      const pdfFilename = `Invoice_${booking._id.substring(0, 8).toUpperCase()}.pdf`;
      
      await this.emailService.sendEmailWithAttachment({
        to: booking.email,
        subject: emailSubject,
        html: emailBody,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
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
