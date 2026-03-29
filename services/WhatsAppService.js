/**
 * WhatsApp Service
 * Sends WhatsApp notifications via Africa's Talking API
 * Handles admin alerts and customer booking confirmations
 */

const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.apiKey = process.env.AFRICAS_TALKING_API_KEY;
    this.userName = process.env.AFRICAS_TALKING_USERNAME || 'Binti_Events';
    this.baseUrl = 'https://api.africastalking.com/version1/messaging';
    this.adminPhone = process.env.ADMIN_WHATSAPP_PHONE; // Format: +254746170866
  }

  /**
   * Validate API credentials on startup
   */
  validateConfig() {
    if (!this.apiKey) {
      logger.warn('[WHATSAPP] API key not configured - WhatsApp notifications disabled');
      return false;
    }
    if (!this.adminPhone) {
      logger.warn('[WHATSAPP] Admin phone not configured - WhatsApp notifications disabled');
      return false;
    }
    logger.info('[WHATSAPP] WhatsApp service configured successfully');
    return true;
  }

  /**
   * Format phone number to international format
   * @param {String} phone - Phone number in any format
   * @returns {String} - Formatted as +254...
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove spaces and special characters
    let cleaned = phone.replace(/\s+/g, '');
    
    // Convert to +254 format
    if (cleaned.startsWith('0')) {
      cleaned = '+254' + cleaned.slice(1);
    } else if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Send WhatsApp message via Africa's Talking
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} message - Message body
   * @returns {Promise<Object>} - API response
   */
  async sendMessage(phoneNumber, message) {
    try {
      if (!this.apiKey) {
        logger.warn('[WHATSAPP] Skipping WhatsApp - API key not configured');
        return { success: false, message: 'WhatsApp API not configured' };
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        logger.error('[WHATSAPP] Invalid phone number:', phoneNumber);
        return { success: false, message: 'Invalid phone number' };
      }

      logger.info('[WHATSAPP] Sending message to:', formattedPhone);

      const response = await axios.post(
        `${this.baseUrl}`,
        {
          username: this.userName,
          to: formattedPhone,
          message: message,
          enqueue: 1, // Queue message if recipient not available
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );

      logger.info('[WHATSAPP] Message sent successfully', {
        phone: formattedPhone,
        messageLength: message.length,
        response: response.data,
      });

      return { success: true, data: response.data };
    } catch (err) {
      logger.error('[WHATSAPP] Failed to send message', {
        phone: phoneNumber,
        error: err.message,
        response: err.response ? err.response.data : null,
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Format booking summary for WhatsApp message
   * @param {Object} booking - Booking document
   * @returns {String} - Formatted message
   */
  formatBookingSummary(booking) {
    const eventDate = new Date(booking.eventDate).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let summary = ` *Booking Confirmation*\n\n`;
    summary += `*Booking ID:* ${booking.id.substring(0, 8).toUpperCase()}\n`;
    summary += `*Name:* ${booking.fullname}\n`;
    summary += `*Phone:* ${booking.phone}\n`;
    summary += `*Email:* ${booking.email}\n\n`;

    summary += ` *Event Details*\n`;
    summary += `*Venue:* ${booking.venue}\n`;
    summary += `*Date:* ${eventDate}\n`;
    summary += `*Setup Time:* ${booking.setupTime}\n\n`;

    summary += ` *Tent Selection*\n`;
    if (booking.tentConfigs && booking.tentConfigs.length > 0) {
      booking.tentConfigs.forEach((tent, idx) => {
        summary += `${idx + 1}. ${this.getTentDisplay(tent)}\n`;
      });
    } else if (booking.tentType) {
      summary += `• ${booking.tentType}`;
      if (booking.tentType === 'stretch' && booking.tentSize) summary += ` (${booking.tentSize})`;
      if (booking.tentType === 'cheese' && booking.cheeseColor) summary += ` - ${booking.cheeseColor}`;
      summary += `\n`;
    }
    summary += `\n`;

    summary += ` *Add-ons*\n`;
    const addOns = [];
    if (booking.lighting) addOns.push('Ambient Lighting');
    if (booking.transport) addOns.push('Transport');
    if (booking.pasound) addOns.push('PA Sound');
    if (booking.dancefloor) addOns.push('Dance Floor');
    if (booking.stagepodium) addOns.push('Stage & Podium');
    if (booking.welcomesigns) addOns.push('Welcome Signs');
    if (booking.decor) addOns.push('Decor (Custom)');
    
    if (addOns.length > 0) {
      summary += addOns.map(addon => `• ${addon}`).join('\n');
    } else {
      summary += '(None)';
    }
    summary += `\n\n`;

    summary += ` *Total Amount:* KES ${booking.totalAmount.toLocaleString()}\n`;
    summary += `*Payment Status:* PAID ✓\n\n`;

    if (booking.additionalInfo) {
      summary += ` *Special Requests:*\n${booking.additionalInfo}\n\n`;
    }

    summary += `For invoice or further details, check your email.\n`;
    summary += `Questions? WhatsApp us: +254728307327\n`;
    summary += `\nThank you for choosing Binti Events! 🎉`;

    return summary;
  }

  /**
   * Format admin alert message
   * @param {Object} booking - Booking document
   * @returns {String} - Formatted message
   */
  formatAdminAlert(booking) {
    const eventDate = new Date(booking.eventDate).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let alert = ` *NEW PAID BOOKING*\n\n`;
    alert += `*Booking ID:* ${booking.id.substring(0, 8).toUpperCase()}\n`;
    alert += `*Customer:* ${booking.fullname}\n`;
    alert += `*Phone:* ${booking.phone}\n`;
    alert += `*Email:* ${booking.email}\n\n`;

    alert += `📍 *Event Info*\n`;
    alert += `*Venue:* ${booking.venue} (${booking.location || 'Nairobi'})\n`;
    alert += `*Date:* ${eventDate}\n`;
    alert += `*Time:* ${booking.setupTime}\n\n`;

    alert += ` *Tent Selection*\n`;
    if (booking.tentConfigs && booking.tentConfigs.length > 0) {
      booking.tentConfigs.forEach((tent, idx) => {
        alert += `${idx + 1}. ${this.getTentDisplay(tent)}\n`;
      });
    }
    alert += `\n`;

    alert += ` *Amount:* KES ${booking.totalAmount.toLocaleString()}\n`;
    alert += `*Payment Method:* ${booking.paymentMethod || 'M-Pesa'}\n`;
    alert += `*Transaction ID:* ${booking.transactionId || 'N/A'}\n\n`;

    alert += `Action needed: Review booking and confirm event details.\n`;
    alert += `Dashboard: Check admin panel for full details.`;

    return alert;
  }

  /**
   * Get tent display string
   * @param {Object} tent - Tent configuration
   * @returns {String} - Display string
   */
  getTentDisplay(tent) {
    if (tent.type === 'stretch') {
      return `Stretch Tent ${tent.size}`;
    } else if (tent.type === 'cheese') {
      return `Cheese Tent${tent.color ? ` (${tent.color})` : ''}`;
    } else if (tent.type === 'aframe' || tent.type === 'a-frame') {
      return `A-Frame (${tent.sections || 1} section${tent.sections > 1 ? 's' : ''})`;
    } else if (tent.type === 'bline' || tent.type === 'b-line') {
      return `B-Line (${tent.config === '100' ? '100 Guest' : '50 Guest'})`;
    } else if (tent.type === 'highpeak' || tent.type === 'high-peak') {
      return `High Peak (${tent.config === '100' ? '100 Seater' : '50 Seater'})`;
    } else if (tent.type === 'pergola') {
      return 'Pergola Tent';
    }
    return tent.type || 'Tent';
  }

  /**
   * Send booking confirmation to customer via WhatsApp
   * @param {Object} booking - Booking document
   * @returns {Promise<Object>}
   */
  async sendBookingConfirmation(booking) {
    if (!this.apiKey) {
      logger.warn('[WHATSAPP] WhatsApp API not configured - skipping customer notification');
      return { success: false, message: 'WhatsApp not configured' };
    }

    try {
      const message = this.formatBookingSummary(booking);
      const result = await this.sendMessage(booking.phone, message);
      
      if (result.success) {
        logger.info('[WHATSAPP] Booking confirmation sent to customer', {
          bookingId: booking.id,
          phone: booking.phone,
        });
      }
      
      return result;
    } catch (err) {
      logger.error('[WHATSAPP] Failed to send booking confirmation', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send admin alert for new paid booking
   * @param {Object} booking - Booking document
   * @returns {Promise<Object>}
   */
  async sendAdminAlert(booking) {
    if (!this.apiKey || !this.adminPhone) {
      logger.warn('[WHATSAPP] WhatsApp API or admin phone not configured - skipping admin alert');
      return { success: false, message: 'WhatsApp not configured' };
    }

    try {
      const message = this.formatAdminAlert(booking);
      const result = await this.sendMessage(this.adminPhone, message);
      
      if (result.success) {
        logger.info('[WHATSAPP] Admin alert sent for new booking', {
          bookingId: booking.id,
          adminPhone: this.adminPhone,
        });
      }
      
      return result;
    } catch (err) {
      logger.error('[WHATSAPP] Failed to send admin alert', err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = () => new WhatsAppService();
