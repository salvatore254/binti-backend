// services/MpesaService.js
const axios = require("axios");

/**
 * M-Pesa Daraja Service
 * Handles OAuth authentication and STK push for live M-Pesa transactions
 */

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    
    // Validate that credentials are set
    const missingCredentials = [];
    if (!this.consumerKey) missingCredentials.push('MPESA_CONSUMER_KEY');
    if (!this.consumerSecret) missingCredentials.push('MPESA_CONSUMER_SECRET');
    if (!this.shortcode) missingCredentials.push('MPESA_SHORTCODE');
    if (!this.passkey) missingCredentials.push('MPESA_PASSKEY');
    
    if (missingCredentials.length > 0) {
      console.warn(`[MPESA] WARNING: Missing credentials in .env file: ${missingCredentials.join(', ')}`);
      console.warn(`[MPESA] M-Pesa STK push will fail until these are configured.`);
    }
    
    // Use production URL by default; sandbox if NODE_ENV is not production or MPESA_USE_SANDBOX is true
    const useSandbox = process.env.MPESA_USE_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    this.baseUrl = useSandbox 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';
    
    this.oauthUrl = `${this.baseUrl}/oauth/v1/generate`;
    this.stkUrl = `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/mpesa-callback`;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    console.log(`[MPESA] Initialized in ${useSandbox ? 'SANDBOX' : 'PRODUCTION'} mode`);
    console.log(`[MPESA] Base URL: ${this.baseUrl}`);
  }

  isConfigured() {
    return Boolean(this.consumerKey && this.consumerSecret && this.shortcode && this.passkey);
  }

  /**
   * Get OAuth access token from Daraja API
   * Tokens are cached for 59 minutes (refresh before expiry)
   */
  async getAccessToken() {
    try {
      // Return cached token if still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        console.log('[MPESA] Using cached access token');
        return this.accessToken;
      }

      console.log('[MPESA] Requesting new access token from Daraja');
      console.log(`[MPESA] OAuth URL: ${this.oauthUrl}`);
      console.log(`[MPESA] Consumer Key: ${this.consumerKey ? this.consumerKey.substring(0, 10) + '...' : 'NOT SET'}`);
      
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios({
        method: 'GET',
        url: `${this.oauthUrl}?grant_type=client_credentials`,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Token expires in 3600 seconds; cache for 59 minutes (3540 seconds)
        this.tokenExpiry = Date.now() + (3540 * 1000);
        console.log('[MPESA] Access token obtained successfully');
        return this.accessToken;
      } else {
        throw new Error('No access token in response');
      }
    } catch (error) {
      console.error('[MPESA] Failed to get access token:', error.message);
      console.error('[MPESA] OAuth URL being used:', this.oauthUrl);
      
      if (error.response?.status) {
        console.error(`[MPESA] HTTP Status: ${error.response.status}`);
        console.error(`[MPESA] Response data:`, JSON.stringify(error.response.data, null, 2));
      }
      
      // Check if sandbox vs production mismatch
      if (error.response?.status === 400) {
        console.error('[MPESA] OAuth returned 400 - likely wrong environment (sandbox creds on prod or vice versa)');
        console.error('[MPESA] Ensure MPESA_USE_SANDBOX=true is set in environment for sandbox credentials');
      }
      
      throw new Error(`OAuth token request failed: ${error.message}`);
    }
  }

  /**
   * Initiate STK Push for M-Pesa payment
   * @param {string} phone - Customer phone number (format: 254712345678 or 0712345678)
   * @param {number} amount - Amount to charge (KES)
   * @param {string} accountRef - Unique reference (booking ID, etc.)
   * @param {string} description - Transaction description
   * @returns {object} - Response with checkout request ID or error
   */
  async initiateStkPush(phone, amount, accountRef, description = 'Binti Events Booking') {
    try {
      // Validate that credentials are configured
      if (!this.isConfigured()) {
        throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, and MPESA_PASSKEY in .env file.');
      }

      // Validate inputs
      if (!phone || !amount || !accountRef) {
        throw new Error('Missing required fields: phone, amount, accountRef');
      }

      // Normalize phone number to 254... format
      const normalizedPhone = this.normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        throw new Error('Invalid phone number format');
      }

      // Validate amount
      if (amount < 1 || amount > 150000) {
        throw new Error('Amount must be between 1 and 150000 KES');
      }

      console.log(`[MPESA] Initiating STK push: ${normalizedPhone}, KES ${amount}, Ref: ${accountRef}`);

      // Get access token
      const token = await this.getAccessToken();

      // Generate timestamp (YYYYMMDDHHmmss)
      const timestamp = this.generateTimestamp();

      // Generate password (Base64 encoded: Shortcode + Passkey + Timestamp)
      const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

      // Prepare STK push request
      const stkRequest = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // Ensure integer
        PartyA: normalizedPhone,
        PartyB: this.shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: accountRef.toString().substring(0, 12), // Max 12 characters
        TransactionDesc: description.substring(0, 40) // Max 40 characters
      };

      console.log('[MPESA] Sending STK request:', {
        phone: normalizedPhone,
        amount: stkRequest.Amount,
        accountRef: stkRequest.AccountReference,
        shortcode: this.shortcode
      });

      // Send STK push request
      const response = await axios({
        method: 'POST',
        url: this.stkUrl,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: stkRequest,
        timeout: 15000
      });

      console.log('[MPESA] STK push initiated successfully');
      console.log('[MPESA] Response status:', response.status);
      console.log('[MPESA] Response data:', JSON.stringify(response.data, null, 2));

      // Check for successful response
      // Daraja returns various codes - need to check for success and errors
      const responseData = response.data;
      
      // Check if ResponseCode indicates success (0 is success, others are error codes)
      if (responseData.ResponseCode === '0' || responseData.ResponseCode === 0) {
        console.log('[MPESA] STK push REQUEST accepted by Safaricom');
        return {
          success: true,
          checkoutRequestId: responseData.CheckoutRequestID,
          responseCode: responseData.ResponseCode,
          responseDescription: responseData.ResponseDescription,
          customerMessage: responseData.CustomerMessage,
          merchantRequestId: responseData.MerchantRequestID
        };
      } else {
        // Non-zero response code means error
        console.error('[MPESA] STK push returned error code:', responseData.ResponseCode);
        console.error('[MPESA] Error description:', responseData.ResponseDescription);
        throw new Error(`STK push failed with code ${responseData.ResponseCode}: ${responseData.ResponseDescription}`);
      }
    } catch (error) {
      console.error('[MPESA] STK push failed:', error.message);
      console.error('[MPESA] Error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Provide helpful debugging info
      if (error.response?.status === 401) {
        console.error('[MPESA] 401 Unauthorized - Check your M-Pesa credentials in .env');
      } else if (error.response?.status === 400) {
        console.error('[MPESA] 400 Bad Request - Check request format and parameters');
        console.error('[MPESA] Response:', JSON.stringify(error.response?.data, null, 2));
      }
      
      throw error;
    }
  }

  /**
   * Query STK push status
   * @param {string} checkoutRequestId - The checkout request ID from STK initiation
   * @param {string} accountRef - The account reference used in STK push
   */
  async queryStkStatus(checkoutRequestId, accountRef) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

      const queryRequest = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: queryRequest,
        timeout: 15000
      });

      console.log('[MPESA] STK status query response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[MPESA] STK query failed:', error.message);
      throw error;
    }
  }

  /**
   * Normalize phone number to Daraja format (254...)
   */
  normalizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let normalized = phone.replace(/\D/g, '');
    
    // Handle different formats
    if (normalized.startsWith('0')) {
      // 0712345678 -> 254712345678
      normalized = '254' + normalized.substring(1);
    } else if (normalized.startsWith('254')) {
      // Already correct format
      return normalized;
    } else if (normalized.length === 9 || normalized.length === 10) {
      // 712345678 -> 254712345678
      normalized = '254' + normalized;
    }
    
    // Validate
    if (!/^254[17]\d{8}$/.test(normalized)) {
      console.warn(`[MPESA] Invalid phone format after normalization: ${normalized}`);
      return null;
    }
    
    return normalized;
  }

  /**
   * Generate timestamp in YYYYMMDDHHmmss format
   */
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${date}${hours}${minutes}${seconds}`;
  }

  /**
   * Validate callback from Daraja
   * In production, you should verify the SSL certificate and validate the signature
   */
  validateCallback(callbackData) {
    // Basic validation - check required fields
    const result = callbackData.Body?.stkCallback?.CallbackMetadata?.Item || [];
    const metadata = {};
    
    for (const item of result) {
      metadata[item.Name] = item.Value;
    }
    
    const resultCode = callbackData.Body?.stkCallback?.ResultCode ?? null;
    // IMPORTANT: Use ?? (nullish coalescing) NOT || (logical OR)
    // ResultCode 0 = success, but 0 || null = null (JS falsy trap!)
    
    // Map common result codes to user-friendly descriptions
    const resultCodeDescriptions = {
      0: 'Payment successful - User completed transaction',
      1: 'User cancelled the transaction',
      1001: 'Unable to queue the transaction',
      1002: 'Invalid Merchant - Account not set up to receive STK',
      1003: 'Invalid account - Missing phone number or account ref',
      1004: 'Unspecified error - Contact M-Pesa support',
      1005: 'Unable to route transaction - Invalid shortcode',
      1006: 'Unable to initialize transaction - Try again',
      1010: 'Could not confirm transaction validity within 3 hours',
      1011: 'Deferred transaction by user - Not initiated on phone',
      1012: 'Authentication failure',
      1014: 'Original transaction ID cannot be found',
      1015: 'The transaction has already been reversed',
      1016: 'Poor network quality on the phone',
      1018: 'The transaction amount exceeds your daily limit',
      1019: 'The transaction amount is less than the minimum allowed for this shortcode',
      1037: 'DS timeout user cannot be reached or user cancelled transaction',
      1040: 'Service not allowed for this shortcode',
      1041: 'Invalid Amount - Amount exceeds maximum allowed',
      1999: 'User did not enter the PIN - Timeout on phone'
    };
    
    return {
      resultCode: resultCode,
      resultDesc: callbackData.Body?.stkCallback?.ResultDesc || null,
      resultCodeDescription: resultCodeDescriptions[resultCode] || 'Unknown error code',
      merchantRequestId: callbackData.Body?.stkCallback?.MerchantRequestID || null,
      checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID || null,
      accountRef: callbackData.Body?.stkCallback?.AccountReference || null,
      amount: metadata.Amount || null,
      mpesaReceiptNumber: metadata.MpesaReceiptNumber || null,
      transactionDate: metadata.TransactionDate || null,
      phoneNumber: metadata.PhoneNumber || null,
      metadata
    };
  }
}

module.exports = MpesaService;
