const axios = require('axios');
const crypto = require('crypto');

class MexpressService {
  constructor() {
    this.baseUrl = (process.env.MEXPRESS_BASE_URL || 'https://mexpress.co.ke').replace(/\/$/, '');
    this.publicKey = process.env.MEXPRESS_PUBLIC_KEY;
    this.secretKey = process.env.MEXPRESS_SECRET_KEY;
    this.returnUrl = process.env.MEXPRESS_RETURN_URL || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
    this.webhookUrl = process.env.MEXPRESS_WEBHOOK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/mexpress-callback`;
    this.checkoutUrl = `${this.baseUrl}/api/checkout/session`;
  }

  isConfigured() {
    return Boolean(this.publicKey && this.secretKey);
  }

  normalizePhoneNumber(phone) {
    if (!phone) return null;

    let normalized = String(phone).replace(/\D/g, '');

    if (normalized.startsWith('0')) {
      normalized = `254${normalized.slice(1)}`;
    } else if (!normalized.startsWith('254')) {
      normalized = `254${normalized}`;
    }

    return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
  }

  signPayload(timestamp, rawBody) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(`${timestamp}.${rawBody}`)
      .digest('base64');
  }

  async createCheckoutSession({ bookingId, amount, currency = 'KES', phone, description }) {
    if (!this.isConfigured()) {
      throw new Error('MEexpress credentials not configured. Set MEXPRESS_PUBLIC_KEY and MEXPRESS_SECRET_KEY.');
    }

    if (!bookingId || !amount) {
      throw new Error('Missing required fields: bookingId and amount');
    }

    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      throw new Error('Invalid phone number format');
    }

    const payload = {
      public_key: this.publicKey,
      order_id: String(bookingId),
      amount: Math.round(Number(amount)),
      currency,
      return_url: this.returnUrl,
      webhook_url: this.webhookUrl,
      note: String(description || bookingId),
      phone: normalizedPhone,
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(payload);
    const signature = this.signPayload(timestamp, rawBody);

    const response = await axios({
      method: 'POST',
      url: this.checkoutUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Mexpress-Key': this.publicKey,
        'X-Mexpress-Timestamp': timestamp,
        'X-Mexpress-Signature': signature,
        'User-Agent': 'BintiEventsBackend/1.0',
      },
      data: rawBody,
      timeout: 20000,
      validateStatus: () => true,
    });

    const responseData = typeof response.data === 'string'
      ? JSON.parse(response.data)
      : response.data;

    if (response.status !== 200 || !responseData?.ok || !responseData?.url) {
      throw new Error(`MEexpress checkout session failed: ${responseData?.error || responseData?.message || `HTTP ${response.status}`}`);
    }

    return {
      success: true,
      checkoutRequestId: responseData.session_id || responseData.reference || `MEXPRESS-${bookingId}`,
      redirectUrl: responseData.url,
      redirect_url: responseData.url,
      url: responseData.url,
      responseCode: response.status,
      responseDescription: responseData.message || 'Checkout session created',
    };
  }

  validateWebhookSignature(headers, rawBody) {
    if (!this.secretKey) {
      return { valid: false, message: 'MEexpress secret not configured' };
    }

    const timestamp = headers['x-mexpress-timestamp'] || headers['X-Mexpress-Timestamp'];
    const signature = headers['x-mexpress-signature'] || headers['X-Mexpress-Signature'];

    if (!timestamp || !signature) {
      return { valid: false, message: 'Missing MEexpress signature headers' };
    }

    const expectedSignature = this.signPayload(String(timestamp), rawBody || '');
    const signatureBuffer = Buffer.from(String(signature));
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, message: 'Invalid MEexpress signature' };
    }

    return { valid: true };
  }

  normalizeWebhookPayload(payload = {}) {
    return {
      orderId: payload.order_id ? String(payload.order_id) : null,
      status: String(payload.status || '').toLowerCase(),
      amount: payload.amount == null ? null : Number(payload.amount),
      receipt: payload.receipt ? String(payload.receipt) : null,
      paidAt: payload.paid_at ? String(payload.paid_at) : null,
      message: payload.message ? String(payload.message) : null,
    };
  }
}

module.exports = MexpressService;