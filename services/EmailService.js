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

    this.resend = resendApiKey ? new Resend(resendApiKey) : null;
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
    if (!this.resend) {
      throw new Error('RESEND_API_KEY not configured');
    }

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
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding:25px 30px;border-bottom:3px solid #FFC0FA;"><img src="https://bintievents.vercel.app/images/logo1.png" alt="Binti Events" width="120" style="display:block;max-width:120px;height:auto;"></td></tr><tr><td style="padding:25px 30px;"><h3 style="color:#7851A9;margin:0 0 16px 0;font-size:16px;">New Enquiry from Website</h3><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:18px;"><tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;width:25%;">Name</td><td style="padding:8px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;">${name}</td></tr><tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #f0f0f0;">Email</td><td style="padding:8px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;">${email}</td></tr><tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;color:#333;font-weight:600;">${phone || 'N/A'}</td></tr></table><h4 style="color:#7851A9;font-size:13px;margin:0 0 8px 0;">Message:</h4><p style="font-size:13px;color:#333;line-height:1.6;background:#fafafa;padding:14px;border-radius:3px;border-left:3px solid #FFC0FA;margin:0;">${message.replace(/\n/g, '<br>')}</p></td></tr><tr><td style="background:#fafafa;border-top:2px solid #FFC0FA;padding:16px 30px;text-align:center;font-size:10px;color:#999;"><strong style="color:#666;">Binti Events Admin</strong> - Automated notification</td></tr></table></td></tr></table></body></html>`,
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
   * HTML template for booking confirmation email - Matches Binti Invoice Theme
   */
  getBookingConfirmationTemplate(booking, depositAmount, remainingAmount) {
    const totalAmount = booking.totalAmount || 0;
    const deposit = depositAmount || Math.round(totalAmount * 0.8);
    const remaining = remainingAmount || (totalAmount - deposit);
    const bookingId = booking._id || booking.id;
    
    let eventDateStr = 'N/A';
    if (booking.eventDate) {
      const eventDate = new Date(booking.eventDate);
      eventDateStr = eventDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    const setupTime = booking.setupTime || 'N/A';
    const logoUrl = 'https://bintievents.vercel.app/images/logo1.png';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Booking Confirmation</title></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center"><table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding:30px 35px 20px 35px;border-bottom:3px solid #FFC0FA;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:50%;vertical-align:middle;"><img src="${logoUrl}" alt="Binti Events" width="140" style="display:block;max-width:140px;height:auto;"></td><td style="width:50%;vertical-align:middle;text-align:right;"><h1 style="margin:0;font-size:26px;color:#333;font-weight:700;">BOOKING<br>CONFIRMATION</h1></td></tr></table></td></tr><tr><td style="padding:30px 35px 10px 35px;"><p style="font-size:15px;color:#333;margin:0 0 6px 0;">Hello <strong>${booking.fullname || 'Valued Customer'}</strong>,</p><p style="font-size:13px;color:#666;margin:0 0 22px 0;">Thank you for choosing Binti Events. Your booking has been received and we look forward to making your event a success.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ff;border-left:4px solid #7851A9;padding:14px 16px;margin-bottom:25px;border-radius:3px;"><tr><td><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Booking Reference</span><br><span style="font-size:18px;color:#7851A9;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:2px;">#${bookingId.slice(0, 8).toUpperCase()}</span></td></tr></table></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Booking Details</h3><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:20px;"><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Full Name</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.fullname || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Phone</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.phone || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Email</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.email || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Venue</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.venue || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Event Date</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${eventDateStr}</td></tr><tr><td style="padding:9px 0;color:#666;">Setup Time</td><td style="padding:9px 0;color:#333;font-weight:600;text-align:right;">${setupTime}</td></tr></table></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Payment Breakdown</h3><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fdf9;border-left:4px solid #4CAF50;padding:16px;border-radius:3px;margin-bottom:20px;font-size:14px;"><tr><td style="padding:8px 0;color:#333;">Total Amount</td><td style="padding:8px 0;color:#4CAF50;font-weight:700;text-align:right;">KES ${totalAmount.toLocaleString()}</td></tr><tr><td colspan="2" style="border-top:1px solid rgba(76,175,80,0.2);padding:0;"></td></tr><tr><td style="padding:8px 0;color:#333;">Deposit Required (80%)</td><td style="padding:8px 0;color:#4CAF50;font-weight:600;text-align:right;">KES ${deposit.toLocaleString()}</td></tr><tr><td style="padding:8px 0;color:#333;">Balance Due (20%)</td><td style="padding:8px 0;color:#4CAF50;font-weight:600;text-align:right;">KES ${remaining.toLocaleString()}</td></tr></table></td></tr><tr><td style="padding:0 35px 25px 35px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ff;border:1px solid #e8d5f5;padding:14px;border-radius:3px;"><tr><td style="color:#7851A9;font-size:13px;text-align:center;">Please complete your deposit payment to secure your booking.</td></tr></table></td></tr><tr><td style="background:#fafafa;border-top:2px solid #FFC0FA;padding:25px 35px;text-align:center;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;color:#666;"><strong style="color:#333;">Binti Events</strong><br><a href="tel:+254728307327" style="color:#7851A9;text-decoration:none;">+254 728 307 327</a> | <a href="mailto:bintievents@gmail.com" style="color:#7851A9;text-decoration:none;">bintievents@gmail.com</a><br>www.bintievents.com</td></tr><tr><td style="padding-top:12px;font-size:11px;color:#999;"><a href="https://www.instagram.com/bintievents/" style="color:#7851A9;text-decoration:none;">Instagram</a> &nbsp; <a href="https://www.facebook.com/bintievents/" style="color:#7851A9;text-decoration:none;">Facebook</a> &nbsp; <a href="https://www.tiktok.com/@bintievents" style="color:#7851A9;text-decoration:none;">TikTok</a></td></tr><tr><td style="padding-top:10px;font-size:10px;color:#bbb;">2026 Binti Events. All rights reserved.</td></tr></table></td></tr></table></td></tr></table></body></html>`;
  }

  /**
   * HTML template for admin notification - Matches Binti Invoice Theme
   */
  getAdminNotificationTemplate(booking, depositAmount) {
    const totalAmount = booking.totalAmount || 0;
    const deposit = depositAmount || (Math.round(totalAmount * 0.8));
    const remaining = totalAmount - deposit;
    const bookingId = booking._id || booking.id;
    const logoUrl = 'https://bintievents.vercel.app/images/logo1.png';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Booking Alert</title></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center"><table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding:30px 35px 20px 35px;border-bottom:3px solid #FFC0FA;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:50%;vertical-align:middle;"><img src="${logoUrl}" alt="Binti Events" width="140" style="display:block;max-width:140px;height:auto;"></td><td style="width:50%;vertical-align:middle;text-align:right;"><h1 style="margin:0;font-size:24px;color:#333;font-weight:700;">NEW BOOKING</h1><span style="display:inline-block;background:#fff3cd;border:1px solid #ffcc02;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;color:#8B6914;margin-top:6px;">PENDING PAYMENT</span></td></tr></table></td></tr><tr><td style="padding:25px 35px 10px 35px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ff;border-left:4px solid #7851A9;padding:14px 16px;margin-bottom:22px;border-radius:3px;"><tr><td><span style="font-size:12px;color:#666;">Booking ID:</span> <strong style="color:#7851A9;font-family:'Courier New',monospace;">${bookingId.slice(0, 12).toUpperCase()}</strong><br><span style="font-size:12px;color:#666;">Status:</span> <strong style="color:#8B6914;">Awaiting Payment</strong></td></tr></table></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Customer Information</h3><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:20px;"><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Full Name</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.fullname || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Phone</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.phone || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;">Email</td><td style="padding:9px 0;color:#333;font-weight:600;text-align:right;">${booking.email || 'N/A'}</td></tr></table></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Event Details</h3><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:20px;"><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Venue</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.venue || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;">Booking Date</td><td style="padding:9px 0;color:#333;font-weight:600;text-align:right;">${new Date().toLocaleDateString('en-KE')}</td></tr></table></td></tr><tr><td style="padding:0 35px 25px 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Payment Summary</h3><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fdf9;border-left:4px solid #4CAF50;padding:16px;border-radius:3px;font-size:14px;"><tr><td style="padding:8px 0;color:#333;">Total Amount</td><td style="padding:8px 0;color:#7851A9;font-weight:700;text-align:right;font-size:16px;">KES ${totalAmount.toLocaleString()}</td></tr><tr><td colspan="2" style="border-top:1px solid rgba(76,175,80,0.2);padding:0;"></td></tr><tr><td style="padding:8px 0;color:#333;">Deposit (80%)</td><td style="padding:8px 0;color:#4CAF50;font-weight:600;text-align:right;">KES ${deposit.toLocaleString()}</td></tr><tr><td style="padding:8px 0;color:#333;">Balance (20%)</td><td style="padding:8px 0;color:#666;font-weight:600;text-align:right;">KES ${remaining.toLocaleString()}</td></tr></table><p style="color:#666;font-size:12px;margin-top:14px;">Follow up on this booking to ensure timely payment. Contact the customer if payment is not received within 24 hours.</p></td></tr><tr><td style="background:#fafafa;border-top:2px solid #FFC0FA;padding:20px 35px;text-align:center;"><p style="font-size:11px;color:#999;margin:0;"><strong style="color:#666;">Binti Events Admin System</strong><br>This is an automated notification.</p></td></tr></table></td></tr></table></body></html>`;
  }

  /**
   * HTML template for payment confirmation email - Matches Binti Invoice Theme
   */
  getPaymentConfirmationTemplate(booking, transactionId) {
    const totalAmount = booking.totalAmount || 0;
    const depositAmount = Math.round(totalAmount * 0.8);
    const remainingAmount = totalAmount - depositAmount;
    const bookingId = booking._id || booking.id;
    const logoUrl = 'https://bintievents.vercel.app/images/logo1.png';
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Payment Confirmation</title></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center"><table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding:30px 35px 20px 35px;border-bottom:3px solid #FFC0FA;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:50%;vertical-align:middle;"><img src="${logoUrl}" alt="Binti Events" width="140" style="display:block;max-width:140px;height:auto;"></td><td style="width:50%;vertical-align:middle;text-align:right;"><h1 style="margin:0;font-size:26px;color:#4CAF50;font-weight:700;">PAYMENT<br>RECEIVED</h1></td></tr></table></td></tr><tr><td style="padding:28px 35px 10px 35px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-left:4px solid #4CAF50;padding:14px 16px;margin-bottom:22px;border-radius:3px;"><tr><td style="text-align:center;"><span style="font-size:13px;color:#2e7d32;font-weight:700;text-transform:uppercase;letter-spacing:1px;">PAYMENT CONFIRMED</span></td></tr></table><p style="font-size:15px;color:#333;margin:0 0 6px 0;">Dear <strong>${booking.fullname || 'Valued Customer'}</strong>,</p><p style="font-size:13px;color:#666;margin:0 0 22px 0;">Thank you for completing your payment. Your booking with Binti Events is now confirmed and we look forward to making your event a success.</p></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Booking Information</h3><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:20px;"><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Booking Reference</td><td style="padding:9px 0;color:#7851A9;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right;font-family:'Courier New',monospace;">#${bookingId.slice(0, 12).toUpperCase()}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Venue</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${booking.venue || 'N/A'}</td></tr><tr><td style="padding:9px 0;color:#666;border-bottom:1px solid #f0f0f0;">Confirmation Date</td><td style="padding:9px 0;color:#333;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">${new Date().toLocaleDateString('en-KE')}</td></tr>${transactionId ? `<tr><td style="padding:9px 0;color:#666;">Transaction ID</td><td style="padding:9px 0;color:#333;font-weight:600;text-align:right;font-family:'Courier New',monospace;">${transactionId}</td></tr>` : ''}</table></td></tr><tr><td style="padding:0 35px;"><h3 style="font-size:13px;color:#7851A9;text-transform:uppercase;border-bottom:2px solid #FFC0FA;padding-bottom:8px;margin:0 0 12px 0;">Payment Summary</h3><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fdf9;border-left:4px solid #4CAF50;padding:16px;border-radius:3px;margin-bottom:20px;font-size:14px;"><tr><td style="padding:8px 0;color:#333;">Deposit Paid (80%)</td><td style="padding:8px 0;color:#4CAF50;font-weight:700;text-align:right;">KES ${depositAmount.toLocaleString()}</td></tr><tr><td style="padding:8px 0;color:#333;">Remaining Balance (20%)</td><td style="padding:8px 0;color:#4CAF50;font-weight:600;text-align:right;">KES ${remainingAmount.toLocaleString()}</td></tr><tr><td colspan="2" style="border-top:1px solid rgba(76,175,80,0.2);padding:0;"></td></tr><tr><td style="padding:10px 0;color:#333;font-weight:700;font-size:15px;">Total Amount</td><td style="padding:10px 0;color:#2e7d32;font-weight:700;font-size:15px;text-align:right;">KES ${totalAmount.toLocaleString()}</td></tr></table></td></tr><tr><td style="padding:0 35px 25px 35px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ff;border-left:4px solid #7851A9;padding:16px;border-radius:3px;"><tr><td><h4 style="font-size:12px;color:#7851A9;text-transform:uppercase;margin:0 0 8px 0;">What's Next</h4><ul style="margin:0;padding:0 0 0 18px;color:#666;font-size:12px;"><li style="margin-bottom:5px;">We will send you remaining payment details via email</li><li style="margin-bottom:5px;">You will receive updates about your event preparation</li><li style="margin-bottom:5px;">Contact us 48 hours before your event for final coordination</li><li>Have any questions? Call +254 728 307 327</li></ul></td></tr></table></td></tr><tr><td style="background:#fafafa;border-top:2px solid #FFC0FA;padding:25px 35px;text-align:center;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;color:#666;"><strong style="color:#333;">Binti Events</strong><br><a href="tel:+254728307327" style="color:#7851A9;text-decoration:none;">+254 728 307 327</a> | <a href="mailto:bintievents@gmail.com" style="color:#7851A9;text-decoration:none;">bintievents@gmail.com</a><br>www.bintievents.com</td></tr><tr><td style="padding-top:12px;font-size:11px;color:#999;"><a href="https://www.instagram.com/bintievents/" style="color:#7851A9;text-decoration:none;">Instagram</a> &nbsp; <a href="https://www.facebook.com/bintievents/" style="color:#7851A9;text-decoration:none;">Facebook</a> &nbsp; <a href="https://www.tiktok.com/@bintievents" style="color:#7851A9;text-decoration:none;">TikTok</a></td></tr><tr><td style="padding-top:10px;font-size:10px;color:#bbb;">2026 Binti Events. All rights reserved.</td></tr></table></td></tr></table></td></tr></table></body></html>`;
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
