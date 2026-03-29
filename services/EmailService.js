/**
 * EmailService
 * Handles all email operations for Binti Events
 * Uses Resend API for reliable cloud email delivery
 */

const { Resend } = require('resend');

class EmailService {
  constructor() {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('[EMAIL] WARNING: RESEND_API_KEY not configured!');
      console.warn('[EMAIL] Emails will fail to send until RESEND_API_KEY is set in .env');
    }

    this.resend = new Resend(resendApiKey);
    // Use verified domain sender, or Resend's test address
    this.fromAddress = process.env.EMAIL_FROM || 'Binti Events <onboarding@resend.dev>';
    this.adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'silvanootieno44@gmail.com';
    
    console.log('[EMAIL] EmailService initialized (Resend API)');
    console.log('[EMAIL] From address:', this.fromAddress);
    console.log('[EMAIL] Admin email:', this.adminEmail);
  }

  /**
   * Send email via Resend
   */
  async _send({ to, subject, html, text, attachments }) {
    const payload = {
      from: this.fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (attachments && attachments.length > 0) payload.attachments = attachments;

    const { data, error } = await this.resend.emails.send(payload);
    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }
    return data;
  }

  /**
   * Send booking confirmation email to customer
   */
  async sendBookingConfirmation(booking) {
    try {
      if (!booking.email) {
        throw new Error('No email address provided in booking');
      }
      
      const depositAmount = Math.round(booking.totalAmount * 0.8);
      const remainingAmount = booking.totalAmount - depositAmount;
      
      // Format event date if available
      let eventDateStr = 'N/A';
      if (booking.eventDate) {
        const eventDate = new Date(booking.eventDate);
        eventDateStr = eventDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
      
      const setupTime = booking.setupTime || 'N/A';

      const data = await this._send({
        to: booking.email,
        subject: `Booking Confirmation - Binti Events (Ref: ${booking.id})`,
        html: this.getBookingConfirmationTemplate(booking, depositAmount, remainingAmount),
      });

      console.log('[EMAIL] Booking confirmation sent to:', booking.email, '(ID:', data.id, ')');
      return { success: true, messageId: data.id };
    } catch (err) {
      console.error('[EMAIL] Error sending booking confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send booking notification to admin
   */
  async sendAdminNotification(booking, depositAmount) {
    try {
      // Ensure values are available
      const totalAmount = booking.totalAmount || 0;
      const deposit = depositAmount || (Math.round(totalAmount * 0.8));
      const remaining = totalAmount - deposit;
      
      if (!this.adminEmail) {
        throw new Error('Admin email not configured (ADMIN_EMAIL environment variable)');
      }
      
      const data = await this._send({
        to: this.adminEmail,
        subject: `New Booking Received - ${booking.fullname} (Ref: ${booking._id || booking.id})`,
        html: this.getAdminNotificationTemplate(booking, deposit),
      });

      console.log('[EMAIL] Admin notification sent to:', this.adminEmail, '(ID:', data.id, ')');
      return { success: true, messageId: data.id };
    } catch (err) {
      console.error('[EMAIL] Error sending admin notification:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send contact form message
   */
  async sendContactMessage(name, email, phone, message, subject) {
    try {
      const data = await this._send({
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
      });

      console.log('[EMAIL] Contact message sent (ID:', data.id, ')');
      return { success: true, messageId: data.id };
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
      if (!booking.email) {
        throw new Error('No email address provided in booking');
      }
      
      const totalAmount = booking.totalAmount || 0;
      const depositAmount = Math.round(totalAmount * 0.8);
      const remainingAmount = totalAmount - depositAmount;
      
      const data = await this._send({
        to: booking.email,
        subject: `Payment Received - Booking Confirmed (Ref: ${booking._id || booking.id})`,
        html: this.getPaymentConfirmationTemplate(booking, transactionId),
      });

      console.log('[EMAIL] Payment confirmation sent to:', booking.email, '(ID:', data.id, ')');
      return { success: true, messageId: data.id };
    } catch (err) {
      console.error('[EMAIL] Error sending payment confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generic email sender with HTML content and attachments
   * Used for sending invoices and other documents
   */
  async sendEmailWithAttachment(options) {
    try {
      if (!options.to) {
        throw new Error('Email recipient (to) not provided');
      }
      if (!options.subject) {
        throw new Error('Email subject not provided');
      }
      
      // Resend expects attachments as { filename, content (base64 string) }
      const resendAttachments = (options.attachments || []).map(a => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      }));

      const data = await this._send({
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: resendAttachments,
      });

      console.log('[EMAIL] Email with attachment sent to:', options.to, '(ID:', data.id, ')');
      return { success: true, messageId: data.id };
    } catch (err) {
      console.error('[EMAIL] Error sending email with attachment:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generic HTML email sender
   * Used for sending flexible HTML emails
   */
  async sendEmailWithHTML(options) {
    try {
      if (!options.to) {
        throw new Error('Email recipient (to) not provided');
      }
      if (!options.subject) {
        throw new Error('Email subject not provided');
      }
      
      const data = await this._send({
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      console.log('[EMAIL] HTML email sent to:', options.to, '(ID:', data.id, ')');
      return { success: true, messageId: data.id };
    } catch (err) {
      console.error('[EMAIL] Error sending HTML email:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * HTML template for booking confirmation email - Matches Binti Quote Theme
   */
  getBookingConfirmationTemplate(booking, depositAmount, remainingAmount) {
    const totalAmount = booking.totalAmount || 0;
    const deposit = depositAmount || Math.round(totalAmount * 0.8);
    const remaining = remainingAmount || (totalAmount - deposit);
    const bookingId = booking._id || booking.id;
    
    // Format event date if available
    let eventDateStr = 'N/A';
    if (booking.eventDate) {
      const eventDate = new Date(booking.eventDate);
      eventDateStr = eventDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Setup time
    const setupTime = booking.setupTime || 'N/A';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Booking Confirmation</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}.wrapper{background-color:#f5f5f5;padding:20px 0}.container{max-width:650px;margin:0 auto;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:4px;overflow:hidden}.header{background:linear-gradient(135deg,#FFC700 0%,#FFB700 100%);padding:40px 30px;text-align:center}.header-content{background:white;border-radius:4px;padding:25px;margin:-20px 0 0 0}.header h1{color:#7851A9;font-size:32px;margin-bottom:3px;font-weight:700}.header p{color:#666;font-size:13px;letter-spacing:1px;text-transform:uppercase}.logo-text{color:#7851A9;font-size:24px;margin-bottom:8px}hr{border:none;border-top:2px solid #FFB700;margin:20px 0}.content{padding:35px 30px}.greeting{font-size:16px;color:#333;margin-bottom:8px;font-weight:600}.subheading{color:#666;font-size:13px;margin-bottom:25px;line-height:1.6}.booking-ref-box{background:#FFF8E6;border-left:5px solid #FFB700;padding:16px;margin-bottom:30px;border-radius:3px}.booking-ref-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}.booking-ref-value{font-size:18px;color:#7851A9;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:2px}.section-title{color:#7851A9;font-size:14px;font-weight:700;margin-top:20px;margin-bottom:12px;text-transform:uppercase;border-bottom:2px solid #FFB700;padding-bottom:8px}.details-table{width:100%;margin:15px 0}.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}.detail-label{color:#666;font-weight:500}.detail-value{color:#333;font-weight:600;text-align:right}.payment-highlight{background:linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 100%);border-left:5px solid #4CAF50;padding:20px;margin:20px 0;border-radius:3px}.price-row{display:flex;justify-content:space-between;padding:10px 0;font-size:14px;font-weight:500}.price-label{color:#333}.price-value{color:#4CAF50;font-weight:bold}.price-total{font-size:16px;color:#2e7d32;font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid rgba(76,175,80,0.3)}.action-text{background:#FFF8E6;border:1px solid #FFE5A5;padding:15px;border-radius:3px;color:#8B6914;font-size:13px;margin:20px 0;text-align:center}.footer-section{background:#f8f8f8;padding:25px 30px;border-top:2px solid #FFB700;text-align:center;font-size:12px;color:#666}.footer-contact{margin-bottom:12px}.footer-contact a{color:#7851A9;text-decoration:none;font-weight:600}.thank-you{font-size:18px;color:#7851A9;font-style:italic;margin:15px 0;font-weight:600}.footer-note{font-size:10px;color:#999;margin-top:12px}@media (max-width:600px){.container{width:100%;margin:0;border-radius:0}.content{padding:20px 15px}.detail-row{flex-direction:column}.detail-value,.price-value{text-align:left;margin-top:3px}}</style></head><body><div class="wrapper"><div class="container"><div class="header"><div class="header-content"><div class="logo-text">🎪 Binti Events</div><h1>BOOKING CONFIRMATION</h1><p>Professional Event Management</p></div></div><div class="content"><p class="greeting">Hello ${booking.fullname || 'Valued Customer'},</p><p class="subheading">Thank you for choosing Binti Events! Your booking has been confirmed and we're excited to help make your event a success!</p><div class="booking-ref-box"><div class="booking-ref-label">Booking Reference</div><div class="booking-ref-value">#${bookingId.slice(0, 8).toUpperCase()}</div></div><div class="section-title">📋 Booking Details</div><div class="details-table"><div class="detail-row"><span class="detail-label">Full Name</span><span class="detail-value">${booking.fullname || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${booking.phone || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${booking.email || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${booking.venue || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Event Date</span><span class="detail-value">${eventDateStr}</span></div><div class="detail-row"><span class="detail-label">Setup Time</span><span class="detail-value">${setupTime}</span></div></div><div class="section-title">💰 Payment Breakdown</div><div class="payment-highlight"><div class="price-row"><span class="price-label">Total Amount</span><span class="price-value">KES ${totalAmount.toLocaleString()}</span></div><hr style="border:none;border-top:1px solid rgba(76,175,80,0.3);margin:12px 0"><div class="price-row"><span class="price-label">Deposit Required (80%)</span><span class="price-value">KES ${deposit.toLocaleString()}</span></div><div class="price-row"><span class="price-label">Balance Due (20%)</span><span class="price-value">KES ${remaining.toLocaleString()}</span></div><div class="price-total">Total: KES ${totalAmount.toLocaleString()}</div></div><div class="action-text">⏰ Please complete your deposit payment to secure your booking. Payment instructions have been sent separately.</div></div><div class="footer-section"><div class="thank-you">Thank You ❤️</div><p style="margin-bottom:10px">We can't wait to bring your event vision to life!</p><div class="footer-contact"><strong>Binti Events</strong><br>📞 <a href="tel:+254728307327">+254 728 307 327</a> | 📧 <a href="mailto:silvanootieno44@gmail.com">silvanootieno44@gmail.com</a><br>🌐 www.bintievents.com</div><div class="footer-note">© 2026 Binti Events. All rights reserved.<br>This is an automated confirmation. Please do not reply to this email.</div></div></div></div></body></html>`;
  }

  /**
   * HTML template for admin notification - Professional Design
   */
  getAdminNotificationTemplate(booking, depositAmount) {
    const totalAmount = booking.totalAmount || 0;
    const deposit = depositAmount || (Math.round(totalAmount * 0.8));
    const remaining = totalAmount - deposit;
    const bookingId = booking._id || booking.id;
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>New Booking Alert</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}.wrapper{background-color:#f8f9fa;padding:40px 0}.container{max-width:700px;margin:0 auto;background:white;box-shadow:0 2px 10px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden}.alert-header{background:linear-gradient(135deg,#e74c3c 0%,#c0392b 100%);padding:30px;text-align:center;color:white}.alert-header h1{font-size:24px;margin-bottom:10px}.alert-badge{display:inline-block;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600}.content{padding:40px 30px}.booking-alert{background:#fff3cd;border-left:4px solid #ff9800;padding:15px;border-radius:4px;margin-bottom:25px}.section-title{color:#7851A9;font-size:16px;font-weight:600;margin-top:25px;margin-bottom:15px;border-bottom:2px solid #f0eef7;padding-bottom:10px}.detail-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px}.detail-label{color:#666;font-weight:500}.detail-value{color:#333;font-weight:600}.amount-box{background:#f0eef7;padding:20px;border-radius:8px;margin:20px 0}.amount-row{display:flex;justify-content:space-between;padding:10px 0;font-weight:600}.amount-label{color:#333}.amount-value{color:#7851A9;font-size:16px}.footer{background-color:#f8f9fa;padding:25px 30px;border-top:1px solid #e8e8e8;text-align:center;font-size:12px;color:#666}.footer-note{font-size:11px;color:#999;margin-top:10px}@media (max-width:700px){.container{width:100%;margin:0;border-radius:0}.content{padding:25px 20px}.detail-row{flex-direction:column}.detail-value{text-align:left;margin-top:5px}}</style></head><body><div class="wrapper"><div class="container"><div class="alert-header"><h1>🔔 New Booking Received</h1><div class="alert-badge">PENDING PAYMENT</div></div><div class="content"><div class="booking-alert"><strong>Booking ID:</strong> ${bookingId.slice(0, 12).toUpperCase()}...<br><strong>Status:</strong> Awaiting Payment</div><div class="section-title">👤 CUSTOMER INFORMATION</div><div class="detail-row"><span class="detail-label">Full Name</span><span class="detail-value">${booking.fullname || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${booking.phone || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${booking.email || 'N/A'}</span></div><div class="section-title">🎪 EVENT DETAILS</div><div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${booking.venue || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Booking Date</span><span class="detail-value">${new Date().toLocaleDateString('en-KE')}</span></div><div class="section-title">💳 PAYMENT SUMMARY</div><div class="amount-box"><div class="amount-row"><span class="amount-label">Total Amount</span><span class="amount-value">KES ${totalAmount.toLocaleString()}</span></div><hr style="border:none;border-top:1px solid rgba(120,81,169,0.2);margin:15px 0"><div class="amount-row"><span class="amount-label">Deposit (80%)</span><span class="amount-value" style="color:#4CAF50">KES ${deposit.toLocaleString()}</span></div><div class="amount-row"><span class="amount-label">Balance (20%)</span><span class="amount-value">KES ${remaining.toLocaleString()}</span></div></div><p style="color:#666;font-size:13px;margin-top:15px">⏳ Follow up on this booking to ensure timely payment. Contact the customer if payment is not received within 24 hours.</p></div><div class="footer"><strong>Binti Events Admin System</strong><br>This is an automated notification. Please do not reply to this email.<div class="footer-note">© 2026 Binti Events. All rights reserved.</div></div></div></div></body></html>`;
  }

  /**
   * HTML template for payment confirmation email - Matches Binti Quote Theme
   */
  getPaymentConfirmationTemplate(booking, transactionId) {
    const totalAmount = booking.totalAmount || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const remainingAmount = totalAmount - depositAmount;
    const bookingId = booking._id || booking.id;
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Confirmation</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}.wrapper{background-color:#f5f5f5;padding:20px 0}.container{max-width:650px;margin:0 auto;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:4px;overflow:hidden}.header{background:linear-gradient(135deg,#FFC700 0%,#FFB700 100%);padding:40px 30px;text-align:center}.header-content{background:white;border-radius:4px;padding:25px;margin:-20px 0 0 0}.header h1{color:#4CAF50;font-size:32px;margin-bottom:3px;font-weight:700}.header p{color:#2e7d32;font-size:13px;letter-spacing:1px;text-transform:uppercase}.logo-text{color:#7851A9;font-size:24px;margin-bottom:8px}.success-badge{display:inline-block;background:#e8f5e9;border:2px solid #4CAF50;border-radius:50%;width:80px;height:80px;display:flex;align-items:center;justify-content:center;font-size:36px;margin:15px 0}hr{border:none;border-top:2px solid #FFB700;margin:20px 0}.content{padding:35px 30px}.greeting{font-size:16px;color:#333;margin-bottom:8px;font-weight:600}.confirmation-message{color:#666;font-size:13px;margin-bottom:25px;line-height:1.6}.confirmed-badge{background:#e8f5e9;border-left:5px solid #4CAF50;padding:16px;margin-bottom:30px;border-radius:3px;text-align:center}.badge-text{color:#2e7d32;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px}.section-title{color:#7851A9;font-size:14px;font-weight:700;margin-top:20px;margin-bottom:12px;text-transform:uppercase;border-bottom:2px solid #FFB700;padding-bottom:8px}.details-table{width:100%;margin:15px 0}.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}.detail-label{color:#666;font-weight:500}.detail-value{color:#333;font-weight:600;text-align:right;font-family:'Courier New',monospace}.payment-summary{background:linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 100%);border-left:5px solid #4CAF50;padding:20px;margin:20px 0;border-radius:3px}.price-row{display:flex;justify-content:space-between;padding:10px 0;font-size:14px}.price-label{color:#333;font-weight:500}.price-value{color:#4CAF50;font-weight:bold}.price-total{font-size:16px;color:#2e7d32;font-weight:700;margin-top:12px;padding-top:12px;border-top:1px solid rgba(76,175,80,0.3)}.next-steps{background:#FFF8E6;border-left:5px solid #FFB700;padding:20px;margin:20px 0;border-radius:3px}.next-steps h3{color:#7851A9;font-size:13px;font-weight:700;margin-bottom:10px;text-transform:uppercase}.next-steps li{margin-left:20px;color:#666;font-size:12px;margin-bottom:6px}.footer-section{background:#f8f8f8;padding:25px 30px;border-top:2px solid #FFB700;text-align:center;font-size:12px;color:#666}.footer-contact{margin-bottom:12px}.footer-contact a{color:#7851A9;text-decoration:none;font-weight:600}.thank-you{font-size:18px;color:#4CAF50;font-style:italic;margin:15px 0;font-weight:600}.footer-note{font-size:10px;color:#999;margin-top:12px}@media (max-width:600px){.container{width:100%;margin:0;border-radius:0}.content{padding:20px 15px}.detail-row{flex-direction:column}.detail-value,.price-value{text-align:left;margin-top:3px}}</style></head><body><div class="wrapper"><div class="container"><div class="header"><div class="header-content"><div class="logo-text">🎪 Binti Events</div><div class="success-badge">✓</div><h1>PAYMENT RECEIVED</h1><p>Your Booking is Confirmed!</p></div></div><div class="content"><p class="greeting">Dear ${booking.fullname || 'Valued Customer'},</p><p class="confirmation-message">Thank you for completing your payment. Your booking with Binti Events is now confirmed and we're excited to help make your event a success!</p><div class="confirmed-badge"><div class="badge-text">✓ PAYMENT CONFIRMED</div></div><div class="section-title">📋 Booking Information</div><div class="details-table"><div class="detail-row"><span class="detail-label">Booking Reference</span><span class="detail-value">#${bookingId.slice(0, 12).toUpperCase()}</span></div><div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${booking.venue || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Confirmation Date</span><span class="detail-value">${new Date().toLocaleDateString('en-KE')}</span></div>${transactionId ? `<div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${transactionId}</span></div>` : ''}</div><div class="section-title">💰 Payment Received</div><div class="payment-summary"><div class="price-row"><span class="price-label">Deposit Paid (80%)</span><span class="price-value">KES ${depositAmount.toLocaleString()}</span></div><div class="price-row" style="margin-top:10px"><span class="price-label">Remaining Balance (20%)</span><span class="price-value">KES ${remainingAmount.toLocaleString()}</span></div><div class="price-total">Total Amount: KES ${totalAmount.toLocaleString()}</div></div><div class="next-steps"><h3>📌 What's Next?</h3><ul><li>We will send you remaining payment payment details via email</li><li>You'll receive updates about your event preparation</li><li>Contact us 48 hours before your event for final coordination</li><li>Have any questions? Call +254 728 307 327</li></ul></div></div><div class="footer-section"><div class="thank-you">Thank You ❤️</div><p style="margin-bottom:10px">We can't wait to bring your event vision to life!</p><div class="footer-contact"><strong>Binti Events</strong><br>📞 <a href="tel:+254728307327">+254 728 307 327</a> | 📧 <a href="mailto:silvanootieno44@gmail.com">silvanootieno44@gmail.com</a><br>🌐 www.bintievents.com</div><div class="footer-note">© 2026 Binti Events. All rights reserved.<br>This is an automated confirmation. Please do not reply to this email.</div></div></div></div></body></html>`;
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
