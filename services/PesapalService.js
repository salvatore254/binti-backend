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
    
    // Determine API URL based on PESAPAL_USE_SANDBOX flag or NODE_ENV
    // Use PESAPAL_API_URL from env if explicitly set
    // Otherwise: check PESAPAL_USE_SANDBOX flag
    // Fallback: check NODE_ENV (production = live API, anything else = sandbox)
    const useSandbox = process.env.PESAPAL_USE_SANDBOX === 'true' || 
                       (process.env.PESAPAL_API_URL && process.env.PESAPAL_API_URL.includes('sandbox'));
    const isProduction = process.env.NODE_ENV === 'production' && !useSandbox;
    
    this.apiUrl = process.env.PESAPAL_API_URL || 
                  (isProduction ? 'https://api.pesapal.com' : 'https://sandbox.pesapal.com');
    
    this.redirectUrl = process.env.PESAPAL_REDIRECT_URL || 'http://localhost:5000/payment-status';
    
    this.authUrl = `${this.apiUrl}/api/Auth/RequestToken`;
    this.orderUrl = `${this.apiUrl}/api/Transactions/InitiatePayment`;
    this.statusUrl = `${this.apiUrl}/api/Transactions/GetTransactionStatus`;
    
    this.accessToken = null;
    this.tokenExpiry = null;
    
    console.log(`[PESAPAL] Initialized in ${useSandbox || !isProduction ? 'SANDBOX' : 'PRODUCTION'} mode`);
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
      console.log('[PESAPAL] Token endpoint:', this.authUrl);
      
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
      console.error('[PESAPAL] Token URL attempted:', this.authUrl);
      
      // Log specific error codes
      if (error.code) {
        console.error('[PESAPAL] Error code:', error.code); // ENOTFOUND, ECONNREFUSED, etc.
      }
      
      if (error.response?.data) {
        console.error('[PESAPAL] API error response:', error.response.data);
      }
      
      // Provide more helpful error messages
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('[PESAPAL] ⚠️  DNS/Network error - Cannot resolve hostname. Check:');
        console.error('  - Internet connectivity');
        console.error('  - PESAPAL_API_URL environment variable (if set)');
        console.error('  - NODE_ENV setting (should be development for sandbox)');
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

      console.log('[PESAPAL] Order creation response:', JSON.stringify(response.data, null, 2));
      console.log('[PESAPAL] Response keys:', Object.keys(response.data || {}));

      // Try both possible field names for iframe URL
      const iframeUrl = response.data?.redirect_url || response.data?.iframe_url || response.data?.payment_url;
      const trackingId = response.data?.order_tracking_id || response.data?.tracking_id || orderRef;

      if (response.data && (iframeUrl || response.data.response_code === 0)) {
        return {
          success: true,
          iframe_url: iframeUrl,
          orderTrackingId: trackingId,
          responseCode: response.data.response_code,
          responseDescription: response.data.response_description,
          fullResponse: response.data
        };
      } else {
        console.error('[PESAPAL] Unexpected response structure:', response.data);
        throw new Error('Invalid Pesapal response - missing iframe URL. Response: ' + JSON.stringify(response.data));
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
