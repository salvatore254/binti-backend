// services/PesapalService.js
const axios = require("axios");

/**
 * Pesapal Payment Gateway Service
 * Handles OAuth authentication and payment order creation
 * Integrates with Pesapal API for iframe-based payments
 */

class PesapalService {
  normalizePhoneNumber(phone) {
    return String(phone || '').replace(/[^0-9]/g, '');
  }

  normalizeMerchantReference(orderRef) {
    const sanitized = String(orderRef || '')
      .replace(/[^A-Za-z0-9._:-]/g, '_')
      .slice(0, 50);

    if (!sanitized) {
      throw new Error('Pesapal order reference is required');
    }

    return sanitized;
  }

  normalizeResponseData(data) {
    if (Buffer.isBuffer(data)) {
      const text = data.toString('utf8');
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }

    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        return data;
      }
    }

    return data;
  }

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
            (isProduction ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3');
    
    this.redirectUrl = process.env.PESAPAL_REDIRECT_URL || process.env.PESAPAL_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/pesapal-callback`;
    this.ipnUrl = process.env.PESAPAL_IPN_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/pesapal-callback`;
    this.notificationId = process.env.PESAPAL_NOTIFICATION_ID || null;
    
    this.authUrl = `${this.apiUrl}/api/Auth/RequestToken`;
    this.registerIpnUrl = `${this.apiUrl}/api/URLSetup/RegisterIPN`;
    this.getIpnListUrl = `${this.apiUrl}/api/URLSetup/GetIpnList`;
    this.orderUrl = `${this.apiUrl}/api/Transactions/SubmitOrderRequest`;
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
      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('Pesapal credentials are missing. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.');
      }

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
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const responseData = this.normalizeResponseData(response.data);

      if (responseData && responseData.token) {
        this.accessToken = responseData.token;
        // Token typically expires in 1 hour; cache for 59 minutes
        this.tokenExpiry = Date.now() + (59 * 60 * 1000);
        console.log('[PESAPAL] Access token obtained successfully');
        return this.accessToken;
      } else {
        const apiErrorMessage = responseData?.error?.message || responseData?.message;
        if (apiErrorMessage) {
          throw new Error(`Pesapal token request rejected: ${apiErrorMessage}`);
        }

        const rawSnippet = typeof responseData === 'string'
          ? responseData.slice(0, 300)
          : JSON.stringify(responseData).slice(0, 300);

        throw new Error(`No access token in response. Raw response: ${rawSnippet || '[empty body]'}`);
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
        console.error('[PESAPAL]  DNS/Network error - Cannot resolve hostname. Check:');
        console.error('  - Internet connectivity from Render');
        console.error('  - PESAPAL_USE_SANDBOX=true is set in Render Environment (Dashboard)');
        console.error('  - PESAPAL_API_URL environment variable');
        console.error('  - Pesapal sandbox API status (https://cybqa.pesapal.com/pesapalv3 might be down)');
      }
      
      throw new Error(`Pesapal authentication failed: ${error.message}`);
    }
  }

  async getNotificationId() {
    if (this.notificationId) {
      return this.notificationId;
    }

    const token = await this.getAccessToken();

    try {
      const listResponse = await axios({
        method: 'GET',
        url: this.getIpnListUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const listData = this.normalizeResponseData(listResponse.data);
      const existingIpn = Array.isArray(listData)
        ? listData.find((entry) => entry?.url === this.ipnUrl && entry?.ipn_id)
        : null;

      if (existingIpn?.ipn_id) {
        this.notificationId = existingIpn.ipn_id;
        return this.notificationId;
      }
    } catch (error) {
      console.warn('[PESAPAL] Failed to fetch registered IPNs:', error.message);
    }

    const registerResponse = await axios({
      method: 'POST',
      url: this.registerIpnUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        url: this.ipnUrl,
        ipn_notification_type: 'GET'
      },
      timeout: 10000
    });

    const registerData = this.normalizeResponseData(registerResponse.data);
    const notificationId = registerData?.ipn_id;

    if (!notificationId) {
      const apiErrorMessage = registerData?.error?.message || registerData?.message;
      throw new Error(`Pesapal IPN registration failed: ${apiErrorMessage || JSON.stringify(registerData)}`);
    }

    this.notificationId = notificationId;
    return this.notificationId;
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

      const normalizedOrderRef = this.normalizeMerchantReference(orderRef);
      const normalizedPhone = this.normalizePhoneNumber(phone);
      const normalizedDescription = String(description || 'Binti Events Booking').slice(0, 100);

      console.log('[PESAPAL] Creating payment order:', {
        amount,
        currency,
        orderRef: normalizedOrderRef,
        email,
        phone: normalizedPhone
      });

      // Get access token
      const token = await this.getAccessToken();
      const notificationId = await this.getNotificationId();

      // Prepare order request payload
      const payload = {
        id: normalizedOrderRef,
        currency,
        amount: parseFloat(amount),
        description: normalizedDescription,
        callback_url: this.redirectUrl,
        redirect_mode: 'PARENT_WINDOW',
        notification_id: notificationId,
        billing_address: {
          email_address: email,
          phone_number: normalizedPhone,
          country_code: 'KE',
          first_name: firstName,
          last_name: lastName,
          line_1: 'Address Line 1',
          line_2: '',
          city: 'Nairobi',
          state: '',
          postal_code: '',
          zip_code: ''
        },
        branch: 'Binti Events'
      };

      console.log('[PESAPAL] Order payload:', JSON.stringify(payload, null, 2));

      // Send order creation request
      const response = await axios({
        method: 'POST',
        url: this.orderUrl,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: payload,
        timeout: 15000
      });

      const responseData = this.normalizeResponseData(response.data);

      console.log('[PESAPAL] Order creation response:', JSON.stringify(responseData, null, 2));
      console.log('[PESAPAL] Response keys:', Object.keys(responseData || {}));

      // Try both possible field names for iframe URL
      const iframeUrl = responseData?.redirect_url || responseData?.iframe_url || responseData?.payment_url;
      const trackingId = responseData?.order_tracking_id || responseData?.tracking_id || orderRef;

      if (responseData && iframeUrl) {
        return {
          success: true,
          iframe_url: iframeUrl,
          orderTrackingId: trackingId,
          responseCode: responseData.status || responseData.response_code,
          responseDescription: responseData.message || responseData.response_description,
          fullResponse: responseData
        };
      } else {
        console.error('[PESAPAL] Unexpected response structure:', responseData);
        throw new Error('Invalid Pesapal response - missing iframe URL. Response: ' + JSON.stringify(responseData));
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
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const responseData = this.normalizeResponseData(response.data);

      console.log('[PESAPAL] Transaction status response:', responseData);

      return {
        success: true,
        orderTrackingId: responseData.order_tracking_id,
        status: responseData.payment_status_description || responseData.status || responseData.status_code,
        statusCode: responseData.status_code,
        paymentMethod: responseData.payment_method,
        amount: responseData.amount,
        currency: responseData.currency,
        description: responseData.description
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
      const orderTrackingId = callbackData.OrderTrackingId || callbackData.order_tracking_id || callbackData.orderTrackingId;

      // Basic validation - check for required fields
      if (!orderTrackingId || orderTrackingId === '') {
        console.warn('[PESAPAL] Invalid callback: missing OrderTrackingId');
        return { valid: false };
      }

      // In production, verify the signature/HMAC
      // For now, just validate the structure
      return {
        valid: true,
        orderTrackingId,
        transactionTrackingId: callbackData.TransactionTrackingId || callbackData.merchant_reference || callbackData.pesapal_transaction_tracking_id || null,
        status: callbackData.Status || callbackData.status || null,
        amount: callbackData.Amount || callbackData.amount || null,
        currency: callbackData.Currency || callbackData.currency || null
      };
    } catch (error) {
      console.error('[PESAPAL] Callback validation error:', error.message);
      return { valid: false };
    }
  }
}

module.exports = PesapalService;
