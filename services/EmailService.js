/**
 * EmailService
 * Handles all email operations for Binti Events
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Initialize transporter with environment variables
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    this.adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  }

  /**
   * Send booking confirmation email to customer
   */
  async sendBookingConfirmation(booking) {
    try {
      const depositAmount = Math.round(booking.totalAmount * 0.8);
      const remainingAmount = booking.totalAmount - depositAmount;

      const mailOptions = {
        from: `"Binti Events" <${process.env.EMAIL_USER}>`,
        to: booking.email,
        subject: `Booking Confirmation - Binti Events (Ref: ${booking.id})`,
        html: this.getBookingConfirmationTemplate(booking, depositAmount, remainingAmount),
        text: `
Booking Confirmation - Binti Events
Booking Reference: ${booking.id}

Dear ${booking.fullname},

Thank you for booking with Binti Events! Your booking has been confirmed.

BOOKING DETAILS:
- Name: ${booking.fullname}
- Phone: ${booking.phone}
- Email: ${booking.email}
- Venue: ${booking.venue}
- Tent Type: ${booking.tentType}
- Total Amount: KES ${booking.totalAmount.toLocaleString()}

PAYMENT BREAKDOWN:
- Deposit Required (80%): KES ${depositAmount.toLocaleString()}
- Balance Due (20%): KES ${remainingAmount.toLocaleString()}

Please proceed to checkout to complete your deposit payment.

Terms and Conditions:
You have accepted our Terms and Conditions. Please review the full terms at:
https://bintievents.vercel.app/terms.html

For any questions, please contact us at:
Phone: +254 728 307 327
Email: info@bintievents.com

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✉️ Booking confirmation sent to:', booking.email, '(Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('❌ Error sending booking confirmation email:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send booking notification to admin
   */
  async sendAdminNotification(booking, depositAmount) {
    try {
      const mailOptions = {
        from: `"Binti Events System" <${process.env.EMAIL_USER}>`,
        to: this.adminEmail,
        subject: `New Booking Received - ${booking.fullname} (Ref: ${booking.id})`,
        html: this.getAdminNotificationTemplate(booking, depositAmount),
        text: `
NEW BOOKING NOTIFICATION

Booking Reference: ${booking.id}
Date: ${new Date().toISOString()}

CUSTOMER DETAILS:
- Name: ${booking.fullname}
- Phone: ${booking.phone}
- Email: ${booking.email}
- Venue: ${booking.venue}

BOOKING DETAILS:
- Tent Type: ${booking.tentType}
- Tent Size: ${booking.tentSize || 'N/A'}
- Lighting: ${booking.lighting ? 'Yes' : 'No'}
- Transport: ${booking.transport ? 'Yes' : 'No'}
- Site Visit: ${booking.siteVisit ? 'Yes' : 'No'}

PRICING:
- Total Amount: KES ${booking.totalAmount.toLocaleString()}
- Deposit Required (80%): KES ${depositAmount.toLocaleString()}
- Remaining Balance (20%): KES ${(booking.totalAmount - depositAmount).toLocaleString()}

PRICING BREAKDOWN:
${JSON.stringify(booking.breakdown, null, 2)}

TERMS ACCEPTANCE:
- Terms Accepted: ${booking.termsAccepted ? 'Yes' : 'No'}
- Accepted At: ${booking.termsAcceptedAt || 'N/A'}

Status: Awaiting Payment

Customer will complete their 80% deposit payment at checkout.
Remaining 20% balance due before event date.
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✉️ Admin notification sent (Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('❌ Error sending admin notification:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send contact form message (existing functionality)
   */
  async sendContactMessage(name, email, phone, message, subject) {
    try {
      const mailOptions = {
        from: `"${name}" <${email}>`,
        to: this.adminEmail,
        subject: subject || `New enquiry from ${name}`,
        html: `
          <h3>New enquiry from Binti website</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
          <h4>Message:</h4>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
        text: `
New enquiry from Binti website

Name: ${name}
Email: ${email}
Phone: ${phone || 'N/A'}

Message:
${message}
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✉️ Contact message sent (Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('❌ Error sending contact message:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Payment confirmation email to customer
   */
  async sendPaymentConfirmation(booking, transactionId) {
    try {
      const mailOptions = {
        from: `"Binti Events" <${process.env.EMAIL_USER}>`,
        to: booking.email,
        subject: `Payment Received - Booking Confirmed (Ref: ${booking.id})`,
        html: this.getPaymentConfirmationTemplate(booking, transactionId),
        text: `
Payment Confirmation - Binti Events

Dear ${booking.fullname},

Your payment has been received and processed successfully!

BOOKING DETAILS:
- Booking Reference: ${booking.id}
- Transaction ID: ${transactionId}
- Venue: ${booking.venue}
- Tent Type: ${booking.tentType}

PAYMENT DETAILS:
- Deposit Paid (80%): KES ${Math.round(booking.totalAmount * 0.8).toLocaleString()}
- Remaining Balance (20%): KES ${Math.round(booking.totalAmount * 0.2).toLocaleString()}
- Total Amount: KES ${booking.totalAmount.toLocaleString()}

NEXT STEPS:
1. We will contact you to confirm final details
2. Pay the remaining 20% balance before event date
3. Receive setup schedule confirmation

We look forward to making your event amazing!

For any questions, please contact us at:
Phone: +254 728 307 327
Email: info@bintievents.com

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✉️ Payment confirmation sent to:', booking.email, '(Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('❌ Error sending payment confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * HTML template for booking confirmation email
   */
  getBookingConfirmationTemplate(booking, depositAmount, remainingAmount) {
    const breakdownHTML = this.formatBreakdown(booking.breakdown);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #7851A9; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
        .header h1 { color: #7851A9; margin: 0; font-size: 24px; }
        .header p { color: #999; margin: 5px 0 0 0; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #4A7A6B; font-size: 16px; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; text-align: right; }
        .highlight { background-color: #f5f0ff; padding: 15px; border-radius: 5px; border-left: 4px solid #7851A9; }
        .price-large { font-size: 18px; font-weight: bold; color: #7851A9; text-align: right; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
        .cta-button { display: inline-block; background-color: #D4AF37; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; text-align: center; margin-top: 20px; }
        .terms-note { background-color: #fff3cd; padding: 12px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; font-size: 14px; color: #856404; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
          <p>Thank you for choosing Binti Events!</p>
        </div>

        <p>Dear ${booking.fullname},</p>
        <p>Your booking has been confirmed. Here are your details:</p>

        <div class="section">
          <h2>Booking Reference: ${booking.id}</h2>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${booking.fullname}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">${booking.phone}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${booking.email}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Venue:</span>
            <span class="detail-value">${booking.venue}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Tent Type:</span>
            <span class="detail-value">${booking.tentType}</span>
          </div>
          ${booking.tentSize ? `<div class="detail-row"><span class="detail-label">Tent Size:</span><span class="detail-value">${booking.tentSize}</span></div>` : ''}
        </div>

        <div class="section">
          <h2>Package Breakdown</h2>
          ${breakdownHTML}
        </div>

        <div class="section">
          <h2>Payment Summary</h2>
          <div class="detail-row">
            <span class="detail-label">Total Amount:</span>
            <span class="detail-value price-large">KES ${booking.totalAmount.toLocaleString()}</span>
          </div>
          <div class="highlight">
            <div class="detail-row">
              <span class="detail-label">Deposit Required (80%):</span>
              <span class="detail-value" style="font-size: 16px; font-weight: bold; color: #7851A9;">KES ${depositAmount.toLocaleString()}</span>
            </div>
            <div class="detail-row" style="margin-top: 10px;">
              <span class="detail-label">Balance Due (20%):</span>
              <span class="detail-value">KES ${remainingAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="terms-note">
          <strong>✓ Terms Accepted:</strong> You have agreed to our Terms and Conditions. Please review the full terms at: https://bintievents.vercel.app/terms.html
        </div>

        <p style="text-align: center;">
          <a href="https://bintievents.vercel.app/checkout.html" class="cta-button">Proceed to Payment</a>
        </p>

        <div class="section">
          <h2>Next Steps</h2>
          <ol>
            <li>Complete your 80% deposit payment to secure your booking</li>
            <li>We will contact you to confirm final event details</li>
            <li>Pay the remaining 20% balance before your event date</li>
            <li>Receive setup schedule and team contact information</li>
          </ol>
        </div>

        <div class="footer">
          <p>
            <strong>Binti Events</strong><br>
            Phone: +254 728 307 327<br>
            Email: info@bintievents.com<br>
            Nairobi, Kenya<br><br>
            <em>Instinctively Elegant</em>
          </p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * HTML template for admin notification
   */
  getAdminNotificationTemplate(booking, depositAmount) {
    const breakdownHTML = this.formatBreakdown(booking.breakdown);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; }
        .container { max-width: 700px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background-color: #7851A9; color: white; padding: 20px; border-radius: 5px; margin-bottom: 30px; text-align: center; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #7851A9; font-size: 16px; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #7851A9; padding-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; text-align: right; }
        .status-pending { background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 New Booking Received</h1>
          <p>Booking Reference: <strong>${booking.id}</strong></p>
        </div>

        <div class="section">
          <h2>Customer Information</h2>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${booking.fullname}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">${booking.phone}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${booking.email}</span>
          </div>
        </div>

        <div class="section">
          <h2>Event Details</h2>
          <div class="detail-row">
            <span class="detail-label">Venue:</span>
            <span class="detail-value">${booking.venue}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Tent Type:</span>
            <span class="detail-value">${booking.tentType}</span>
          </div>
          ${booking.tentSize ? `<div class="detail-row"><span class="detail-label">Tent Size:</span><span class="detail-value">${booking.tentSize}</span></div>` : ''}
          <div class="detail-row">
            <span class="detail-label">Lighting:</span>
            <span class="detail-value">${booking.lighting ? '✓ Yes' : 'No'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Transport:</span>
            <span class="detail-value">${booking.transport ? '✓ Yes' : 'No'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Site Visit:</span>
            <span class="detail-value">${booking.siteVisit ? '✓ Yes' : 'No'}</span>
          </div>
        </div>

        <div class="section">
          <h2>Pricing Breakdown</h2>
          ${breakdownHTML}
          <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #ddd;">
            <div class="detail-row">
              <span class="detail-label"><strong>Total Amount:</strong></span>
              <span class="detail-value"><strong>KES ${booking.totalAmount.toLocaleString()}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Deposit (80%):</span>
              <span class="detail-value">KES ${depositAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="status-pending">
          <strong>⏳ Status:</strong> Awaiting Payment<br>
          <strong>Terms Accepted:</strong> ${booking.termsAccepted ? '✓ Yes' : 'No'}<br>
          <strong>Accepted At:</strong> ${booking.termsAcceptedAt ? new Date(booking.termsAcceptedAt).toLocaleString() : 'N/A'}
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification from the Binti Events booking system.
        </p>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * HTML template for payment confirmation email
   */
  getPaymentConfirmationTemplate(booking, transactionId) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 30px; text-align: center; }
        .section { margin-bottom: 30px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; text-align: right; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Payment Received</h1>
          <p>Your booking is confirmed!</p>
        </div>

        <p>Dear ${booking.fullname},</p>
        <p>Your payment has been successfully processed. Your booking is now confirmed!</p>

        <div class="section">
          <h2>Payment Details</h2>
          <div class="detail-row">
            <span class="detail-label">Transaction ID:</span>
            <span class="detail-value">${transactionId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Booking Reference:</span>
            <span class="detail-value">${booking.id}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Deposit Paid (80%):</span>
            <span class="detail-value">KES ${Math.round(booking.totalAmount * 0.8).toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Balance (20%):</span>
            <span class="detail-value">KES ${Math.round(booking.totalAmount * 0.2).toLocaleString()}</span>
          </div>
        </div>

        <div class="footer" style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
          <p><strong>Binti Events</strong><br>Phone: +254 728 307 327 | Email: info@bintievents.com</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Format booking breakdown for email display
   */
  formatBreakdown(breakdown) {
    if (!breakdown) return '<p>N/A</p>';

    let html = '';
    if (breakdown.tent) {
      html += `<div class="detail-row"><span class="detail-label">Tent ${breakdown.tent.type}:</span><span class="detail-value">KES ${breakdown.tent.cost?.toLocaleString() || 'N/A'}</span></div>`;
    }
    if (breakdown.lighting > 0) {
      html += `<div class="detail-row"><span class="detail-label">Lighting:</span><span class="detail-value">KES ${breakdown.lighting.toLocaleString()}</span></div>`;
    }
    if (breakdown.transport?.cost > 0) {
      html += `<div class="detail-row"><span class="detail-label">Transport:</span><span class="detail-value">KES ${breakdown.transport.cost.toLocaleString()}</span></div>`;
    }
    if (breakdown.siteVisit?.cost > 0) {
      html += `<div class="detail-row"><span class="detail-label">Site Visit:</span><span class="detail-value">KES ${breakdown.siteVisit.cost.toLocaleString()}</span></div>`;
    }

    return html || '<p>Basic package</p>';
  }
}

module.exports = new EmailService();
