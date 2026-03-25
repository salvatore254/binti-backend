// services/PesapalService.js
const axios = require("axios");

/**
 * Pesapal Payment Gateway Service
 * Handles OAuth authentication and payment order creation
 * Integrates with Pesapal API for iframe-based payments
 */

class PesapalService {
  constructor() {
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY;
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
    this.apiUrl = process.env.PESAPAL_API_URL || 'https://api.pesapal.com';
    this.redirectUrl = process.env.PESAPAL_REDIRECT_URL || 'http://localhost:5000/payment-status';
    
    this.authUrl = `${this.apiUrl}/api/Auth/RequestToken`;
    this.orderUrl = `${this.apiUrl}/api/Transactions/InitiatePaymentRelease`;
    this.statusUrl = `${this.apiUrl}/api/Transactions/GetTransactionStatus`;
    
    this.accessToken = null;
    this.tokenExpiry = null;
    
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`[PESAPAL] Initialized in ${isProduction ? 'PRODUCTION' : 'SANDBOX'} mode`);
    console.log(`[PESAPAL] API URL: ${this.apiUrl}`);
  }

  /**
   * Get OAuth access token from Pesapal API
   * Tokens are cached and reused until expiry
   */
  async getAccessToken() {
    try {
      // Return cached token if still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        console.log('[PESAPAL] Using cached access token');
        return this.accessToken;
      }

      console.log('[PESAPAL] Requesting new access token');
      
      const response = await axios({
        method: 'POST',
        url: this.authUrl,
        data: {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.token) {
        this.accessToken = response.data.token;
        // Token typically expires in 1 hour; cache for 59 minutes
        this.tokenExpiry = Date.now() + (59 * 60 * 1000);
        console.log('[PESAPAL] Access token obtained successfully');
        return this.accessToken;
      } else {
        throw new Error('No access token in response');
      }
    } catch (error) {
      console.error('[PESAPAL] Failed to get access token:', error.message);
      if (error.response?.data) {
        console.error('[PESAPAL] Error details:', error.response.data);
      }
      throw new Error(`Pesapal authentication failed: ${error.message}`);
    }
  }

  /**
   * Create a payment order and return iframe URL
   * @param {object} orderData - Payment order details
   * @returns {object} - { success: true, iframe_url, orderTrackingId }
   */
  async createOrder(orderData) {
    try {
      const {
        amount,
        currency = 'KES',
        orderRef,
        description,
        email,
        phone,
        firstName = 'Customer',
        lastName = 'Name'
      } = orderData;

      // Validate inputs
      if (!amount || !orderRef || !email) {
        throw new Error('Missing required fields: amount, orderRef, email');
      }

      console.log('[PESAPAL] Creating payment order:', {
        amount,
        currency,
        orderRef,
        email,
        phone
      });

      // Get access token
      const token = await this.getAccessToken();

      // Prepare order request payload
      const payload = {
        Id: orderRef,
        Currency: currency,
        Amount: parseFloat(amount),
        Description: description || 'Binti Events Booking',
        Callback: this.redirectUrl,
        Notification: {
          id: orderRef
        },
        BillingAddress: {
          email_address: email,
          phone_number: phone || '',
          first_name: firstName,
          last_name: lastName,
          line_1: 'Address Line 1',
          postal_code: '00100',
          city: 'Nairobi',
          state: 'County',
          country: 'KE'
        },
        Tags: 'binti-events|booking'
      };

      console.log('[PESAPAL] Order payload:', JSON.stringify(payload, null, 2));

      // Send order creation request
      const response = await axios({
        method: 'POST',
        url: this.orderUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: payload,
        timeout: 15000
      });

      console.log('[PESAPAL] Order creation response:', response.data);

      if (response.data && response.data.redirect_url) {
        return {
          success: true,
          iframe_url: response.data.redirect_url,
          orderTrackingId: response.data.order_tracking_id || orderRef,
          responseCode: response.data.response_code,
          responseDescription: response.data.response_description
        };
      } else {
        throw new Error('No redirect URL in Pesapal response');
      }
    } catch (error) {
      console.error('[PESAPAL] Order creation failed:', error.message);
      if (error.response?.data) {
        console.error('[PESAPAL] Error response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Query payment transaction status
   * @param {string} orderTrackingId - The tracking ID from order creation
   */
  async getTransactionStatus(orderTrackingId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios({
        method: 'GET',
        url: `${this.statusUrl}?orderTrackingId=${orderTrackingId}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('[PESAPAL] Transaction status response:', response.data);

      return {
        success: true,
        orderTrackingId: response.data.order_tracking_id,
        status: response.data.status,
        statusCode: response.data.status_code,
        paymentMethod: response.data.payment_method,
        amount: response.data.amount,
        currency: response.data.currency,
        description: response.data.description
      };
    } catch (error) {
      console.error('[PESAPAL] Status query failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate callback from Pesapal
   * Verifies that the callback is legitimate
   */
  validateCallback(callbackData) {
    try {
      // Basic validation - check for required fields
      if (!callbackData.OrderTrackingId || callbackData.OrderTrackingId === '') {
        console.warn('[PESAPAL] Invalid callback: missing OrderTrackingId');
        return { valid: false };
      }

      // In production, verify the signature/HMAC
      // For now, just validate the structure
      return {
        valid: true,
        orderTrackingId: callbackData.OrderTrackingId,
        status: callbackData.Status,
        amount: callbackData.Amount,
        currency: callbackData.Currency
      };
    } catch (error) {
      console.error('[PESAPAL] Callback validation error:', error.message);
      return { valid: false };
    }
  }
}

module.exports = PesapalService;
