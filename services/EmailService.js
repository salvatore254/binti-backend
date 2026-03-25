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

PAYMENT BREAKDOWN:
- Deposit Required (80%): KES ${depositAmount.toLocaleString()}
- Balance Due (20%): KES ${remainingAmount.toLocaleString()}

Please proceed to checkout to complete your deposit payment.

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(' Booking confirmation sent to:', booking.email, '(Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(' Error sending booking confirmation email:', err.message);
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
- Total Amount: KES ${booking.totalAmount.toLocaleString()}
- Deposit Required (80%): KES ${depositAmount.toLocaleString()}
- Remaining Balance (20%): KES ${(booking.totalAmount - depositAmount).toLocaleString()}

Status: Awaiting Payment
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(' Admin notification sent (Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(' Error sending admin notification:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send contact form message
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
      console.log(' Contact message sent (Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(' Error sending contact message:', err.message);
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

PAYMENT DETAILS:
- Deposit Paid (80%): KES ${Math.round(booking.totalAmount * 0.8).toLocaleString()}
- Remaining Balance (20%): KES ${Math.round(booking.totalAmount * 0.2).toLocaleString()}
- Total Amount: KES ${booking.totalAmount.toLocaleString()}

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(' Payment confirmation sent to:', booking.email, '(Message ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(' Error sending payment confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * HTML template for booking confirmation email
   */
  getBookingConfirmationTemplate(booking, depositAmount, remainingAmount) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; }
        .header { border-bottom: 3px solid #7851A9; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #7851A9; margin: 0; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #4A7A6B; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; text-align: right; }
        .highlight { background-color: #f5f0ff; padding: 15px; border-radius: 5px; border-left: 4px solid #7851A9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
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
        </div>

        <div class="section">
          <h2>Payment Summary</h2>
          <div class="detail-row">
            <span class="detail-label">Total Amount:</span>
            <span class="detail-value">KES ${booking.totalAmount.toLocaleString()}</span>
          </div>
          <div class="highlight">
            <div class="detail-row">
              <span class="detail-label">Deposit Required (80%):</span>
              <span class="detail-value">KES ${depositAmount.toLocaleString()}</span>
            </div>
            <div class="detail-row" style="margin-top: 10px;">
              <span class="detail-label">Balance Due (20%):</span>
              <span class="detail-value">KES ${remainingAmount.toLocaleString()}</span>
            </div>
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
   * HTML template for admin notification
   */
  getAdminNotificationTemplate(booking, depositAmount) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 700px; margin: 0 auto; background-color: white; padding: 30px; }
        .header { background-color: #7851A9; color: white; padding: 20px; text-align: center; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #7851A9; margin-bottom: 15px; border-bottom: 2px solid #7851A9; padding-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Booking Received</h1>
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
            <span class="detail-label">Total Amount:</span>
            <span class="detail-value">KES ${booking.totalAmount.toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Deposit (80%):</span>
            <span class="detail-value">KES ${depositAmount.toLocaleString()}</span>
          </div>
        </div>

        <p style="color: #666; font-size: 12px;">
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
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .section { margin-bottom: 30px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { color: #666; font-weight: 600; }
        .detail-value { color: #333; text-align: right; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Received</h1>
          <p>Your booking is confirmed!</p>
        </div>

        <p>Dear ${booking.fullname},</p>
        <p>Your payment has been successfully processed.</p>

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

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
          <p><strong>Binti Events</strong><br>Phone: +254 728 307 327 | Email: info@bintievents.com</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

// Lazy instantiation - avoid blocking startup with email service
let emailServiceInstance = null;

function getEmailService() {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

module.exports = getEmailService;
