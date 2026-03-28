/**
 * EmailService
 * Handles all email operations for Binti Events
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Initialize transporter with environment variables
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    // Warn if email credentials are missing
    if (!emailUser || !emailPass) {
      console.warn('[EMAIL] WARNING: Email credentials not configured!');
      console.warn('[EMAIL] EMAIL_USER:', emailUser ? 'SET' : 'NOT SET');
      console.warn('[EMAIL] EMAIL_PASS:', emailPass ? 'SET' : 'NOT SET');
      console.warn('[EMAIL] Emails will fail to send until credentials are configured in .env');
    }
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
      }
    });

    this.adminEmail = process.env.ADMIN_EMAIL || emailUser;
    console.log('[EMAIL] EmailService initialized');
    console.log('[EMAIL] Sending emails from:', emailUser);
    console.log('[EMAIL] Admin email:', this.adminEmail);
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
- Event Date: ${eventDateStr}
- Setup Time: ${setupTime}

PAYMENT BREAKDOWN:
- Deposit Required (80%): KES ${depositAmount.toLocaleString()}
- Balance Due (20%): KES ${remainingAmount.toLocaleString()}

Please proceed to checkout to complete your deposit payment.

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Booking confirmation sent to:', booking.email, '(ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL] Error sending booking confirmation:', err.message);
      console.error('[EMAIL] Error code:', err.code);
      console.error('[EMAIL] Full error:', err);
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
      
      const mailOptions = {
        from: `"Binti Events System" <${process.env.EMAIL_USER}>`,
        to: this.adminEmail,
        subject: `New Booking Received - ${booking.fullname} (Ref: ${booking._id || booking.id})`,
        html: this.getAdminNotificationTemplate(booking, deposit),
        text: `
NEW BOOKING NOTIFICATION

Booking Reference: ${booking._id || booking.id}
Date: ${new Date().toISOString()}

CUSTOMER DETAILS:
- Name: ${booking.fullname}
- Phone: ${booking.phone}
- Email: ${booking.email}
- Venue: ${booking.venue}

BOOKING DETAILS:
- Total Amount: KES ${totalAmount.toLocaleString()}
- Deposit Required (80%): KES ${deposit.toLocaleString()}
- Remaining Balance (20%): KES ${remaining.toLocaleString()}

Status: Awaiting Payment
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Admin notification sent to:', this.adminEmail, '(ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL] Error sending admin notification:', err.message);
      console.error('[EMAIL] Error code:', err.code);
      console.error('[EMAIL] Full error:', err);
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
      if (!booking.email) {
        throw new Error('No email address provided in booking');
      }
      
      const totalAmount = booking.totalAmount || 0;
      const depositAmount = Math.round(totalAmount * 0.8);
      const remainingAmount = totalAmount - depositAmount;
      
      const mailOptions = {
        from: `"Binti Events" <${process.env.EMAIL_USER}>`,
        to: booking.email,
        subject: `Payment Received - Booking Confirmed (Ref: ${booking._id || booking.id})`,
        html: this.getPaymentConfirmationTemplate(booking, transactionId),
        text: `
Payment Confirmation - Binti Events

Dear ${booking.fullname || 'Valued Customer'},

Your payment has been received and processed successfully!

BOOKING DETAILS:
- Booking Reference: ${booking._id || booking.id}
- Transaction ID: ${transactionId || 'N/A'}
- Venue: ${booking.venue || 'N/A'}

PAYMENT DETAILS:
- Deposit Paid (80%): KES ${depositAmount.toLocaleString()}
- Remaining Balance (20%): KES ${remainingAmount.toLocaleString()}
- Total Amount: KES ${totalAmount.toLocaleString()}

Best regards,
Binti Events Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Payment confirmation sent to:', booking.email, '(ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL] Error sending payment confirmation:', err.message);
      console.error('[EMAIL] Error code:', err.code);
      console.error('[EMAIL] Full error:', err);
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
      
      const mailOptions = {
        from: `"Binti Events" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || [],
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Email with attachment sent to:', options.to, '(ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL] Error sending email with attachment:', err.message);
      console.error('[EMAIL] Error code:', err.code);
      console.error('[EMAIL] Full error:', err);
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
      
      const mailOptions = {
        from: `"Binti Events" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] HTML email sent to:', options.to, '(ID:', info.messageId, ')');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL] Error sending HTML email:', err.message);
      console.error('[EMAIL] Error code:', err.code);
      console.error('[EMAIL] Full error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * HTML template for booking confirmation email - Professional Design
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
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Booking Confirmation</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}.wrapper{background-color:#f8f9fa;padding:40px 0}.container{max-width:600px;margin:0 auto;background:white;box-shadow:0 2px 10px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden}.logo-section{background:linear-gradient(135deg,#7851A9 0%,#6b3fa0 100%);padding:30px;text-align:center}.logo-section h1{color:white;font-size:28px;margin-bottom:5px}.logo-section p{color:rgba(255,255,255,0.9);font-size:14px}.content{padding:40px 30px}.greeting{font-size:18px;color:#333;margin-bottom:10px}.subheading{color:#666;font-size:14px;margin-bottom:30px}.booking-ref{background:#f0eef7;border-left:4px solid #7851A9;padding:15px;border-radius:4px;margin-bottom:30px}.booking-ref-label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}.booking-ref-value{font-size:20px;color:#7851A9;font-weight:bold;font-family:'Courier New',monospace}.section-title{color:#7851A9;font-size:16px;font-weight:600;margin-top:25px;margin-bottom:15px;border-bottom:2px solid #f0eef7;padding-bottom:10px}.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f5f5f5;font-size:14px}.detail-label{color:#666;font-weight:500}.detail-value{color:#333;font-weight:600;text-align:right}.highlight-box{background:linear-gradient(135deg,#f0eef7 0%,#f8f6fc 100%);padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e8dff5}.price-row{display:flex;justify-content:space-between;padding:12px 0;font-size:15px}.price-label{color:#333;font-weight:500}.price-value{color:#7851A9;font-weight:bold;font-size:16px}.footer{background-color:#f8f9fa;padding:30px;border-top:1px solid #e8e8e8;text-align:center;font-size:12px;color:#666}.footer-contact{margin-bottom:15px}.footer-contact a{color:#7851A9;text-decoration:none}.footer-note{font-size:11px;color:#999;margin-top:15px}@media (max-width:600px){.container{width:100%;margin:0;border-radius:0}.content{padding:25px 20px}.detail-row{flex-direction:column}.detail-value{text-align:left;margin-top:5px}}</style></head><body><div class="wrapper"><div class="container"><div class="logo-section"><h1>🎪 Binti Events</h1><p>Professional Event Management</p></div><div class="content"><p class="greeting">Hello ${booking.fullname || 'Valued Customer'},</p><p class="subheading">Thank you for choosing Binti Events! Your booking has been confirmed. Please review the details below.</p><div class="booking-ref"><div class="booking-ref-label">Booking Reference</div><div class="booking-ref-value">${bookingId.slice(0, 8).toUpperCase()}</div></div><div class="section-title">📋 BOOKING DETAILS</div><div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${booking.fullname || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${booking.phone || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${booking.email || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${booking.venue || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Event Date</span><span class="detail-value">${eventDateStr}</span></div><div class="detail-row"><span class="detail-label">Setup Time</span><span class="detail-value">${setupTime}</span></div><div class="section-title">💰 PAYMENT INFORMATION</div><div class="highlight-box"><div class="price-row"><span class="price-label">Total Amount</span><span class="price-value">KES ${totalAmount.toLocaleString()}</span></div><hr style="border:none;border-top:1px solid rgba(120,81,169,0.2);margin:15px 0"><div class="price-row"><span class="price-label">Deposit Required (80%)</span><span class="price-value" style="color:#4CAF50">KES ${deposit.toLocaleString()}</span></div><div class="price-row"><span class="price-label">Balance Due (20%)</span><span class="price-value">KES ${remaining.toLocaleString()}</span></div></div><p style="color:#666;font-size:14px;margin-top:20px">⏰ Please complete your payment to secure your booking. A payment link has been sent separately.</p></div><div class="footer"><div class="footer-contact"><strong>Binti Events</strong><br>📞 <a href="tel:+254728307327">+254 728 307 327</a> | 📧 <a href="mailto:info@bintievents.com">info@bintievents.com</a></div><div class="footer-note">© 2026 Binti Events. All rights reserved.<br>This is an automated confirmation. Please do not reply to this email.</div></div></div></div></body></html>`;
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
   * HTML template for payment confirmation email - Professional Design
   */
  getPaymentConfirmationTemplate(booking, transactionId) {
    const totalAmount = booking.totalAmount || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const remainingAmount = totalAmount - depositAmount;
    const bookingId = booking._id || booking.id;
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Confirmation</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;line-height:1.6}.wrapper{background-color:#f8f9fa;padding:40px 0}.container{max-width:600px;margin:0 auto;background:white;box-shadow:0 2px 10px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden}.success-header{background:linear-gradient(135deg,#4CAF50 0%,#45a049 100%);padding:40px 30px;text-align:center;color:white}.success-icon{font-size:48px;margin-bottom:15px}.success-header h1{font-size:28px;margin-bottom:5px}.success-header p{font-size:14px;opacity:0.9}.content{padding:40px 30px}.greeting{font-size:18px;margin-bottom:10px}.confirmation-message{color:#666;font-size:14px;margin-bottom:30px;line-height:1.8}.success-badge{background:#e8f5e9;border:2px solid #4CAF50;border-radius:8px;padding:15px;margin-bottom:25px;text-align:center}.success-badge-text{color:#2e7d32;font-weight:600;font-size:14px}.section-title{color:#7851A9;font-size:16px;font-weight:600;margin-top:25px;margin-bottom:15px;border-bottom:2px solid #f0eef7;padding-bottom:10px}.detail-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px}.detail-label{color:#666;font-weight:500}.detail-value{color:#333;font-weight:600;font-family:'Courier New',monospace}.payment-summary{background:linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 100%);padding:25px;border-radius:8px;margin:20px 0;border-left:4px solid #4CAF50}.summary-row{display:flex;justify-content:space-between;padding:10px 0;font-size:15px}.summary-label{color:#333;font-weight:500}.summary-value{color:#2e7d32;font-weight:bold;font-size:16px}.next-steps{background:#f0eef7;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #7851A9}.next-steps h3{color:#7851A9;font-size:14px;margin-bottom:10px}.next-steps li{margin-left:20px;color:#666;font-size:13px;margin-bottom:8px}.footer{background-color:#f8f9fa;padding:30px;border-top:1px solid #e8e8e8;text-align:center;font-size:12px;color:#666}.footer-contact{margin-bottom:15px}.footer-contact a{color:#7851A9;text-decoration:none}.footer-note{font-size:11px;color:#999;margin-top:15px}@media (max-width:600px){.container{width:100%;margin:0;border-radius:0}.content{padding:25px 20px}.detail-row,.summary-row{flex-direction:column}.detail-value,.summary-value{text-align:left;margin-top:5px}}</style></head><body><div class="wrapper"><div class="container"><div class="success-header"><div class="success-icon">✓</div><h1>Payment Received</h1><p>Your booking is now confirmed!</p></div><div class="content"><p class="greeting">Dear ${booking.fullname || 'Valued Customer'},</p><p class="confirmation-message">Thank you for completing your payment. We're thrilled to confirm your booking with Binti Events. Your event is in good hands!</p><div class="success-badge"><div class="success-badge-text">✓ PAYMENT CONFIRMED</div></div><div class="section-title">📋 BOOKING INFORMATION</div><div class="detail-row"><span class="detail-label">Booking Reference</span><span class="detail-value">${bookingId.slice(0, 12).toUpperCase()}</span></div><div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${booking.venue || 'N/A'}</span></div><div class="detail-row"><span class="detail-label">Confirmation Date</span><span class="detail-value">${new Date().toLocaleDateString('en-KE')}</span></div><div class="section-title">💰 PAYMENT DETAILS</div><div class="payment-summary"><div class="summary-row"><span class="summary-label">Deposit Paid (80%)</span><span class="summary-value">KES ${depositAmount.toLocaleString()}</span></div><div class="summary-row" style="margin-top:15px"><span class="summary-label">Remaining Balance (20%)</span><span class="summary-value" style="color:#7851A9">KES ${remainingAmount.toLocaleString()}</span></div><hr style="border:none;border-top:1px solid rgba(76,175,80,0.2);margin:15px 0"><div class="summary-row" style="font-size:16px;font-weight:bold"><span class="summary-label" style="color:#333">Total Amount</span><span class="summary-value" style="color:#2e7d32;font-size:18px">KES ${totalAmount.toLocaleString()}</span></div></div>${transactionId ? `<div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${transactionId}</span></div>` : ''}<div class="next-steps"><h3>📌 WHAT'S NEXT?</h3><ul><li>We will follow up with remaining payment details via email</li><li>You'll receive updates about your event preparation</li><li>Contact us 48 hours before your event for final coordination</li></ul></div><p style="color:#666;font-size:14px;margin-top:20px;text-align:center">Have questions? Contact us anytime at <a href="tel:+254728307327" style="color:#7851A9;text-decoration:none">+254 728 307 327</a></p></div><div class="footer"><div class="footer-contact"><strong>Binti Events</strong><br>📞 <a href="tel:+254728307327">+254 728 307 327</a> | 📧 <a href="mailto:info@bintievents.com">info@bintievents.com</a></div><div class="footer-note">© 2026 Binti Events. All rights reserved.<br>This is an automated confirmation. Please do not reply to this email.</div></div></div></div></body></html>`;
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
