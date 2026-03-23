# M-Pesa Production Setup Guide

## Overview
The Binti Events backend now includes **full production-ready M-Pesa Daraja integration**. The system automatically detects whether to use sandbox or production based on your `NODE_ENV` setting.

---

## Quick Start: Switch to Production

### Step 1: Update Environment Variables

In your `.env` file, ensure these settings are configured:

```env
# Set to 'production' to use the LIVE M-Pesa API
NODE_ENV=production

# M-Pesa Daraja Credentials (from https://developer.safaricom.co.ke/)
MPESA_CONSUMER_KEY=your_production_consumer_key
MPESA_CONSUMER_SECRET=your_production_consumer_secret
MPESA_SHORTCODE=174379  # Your business paybill number
MPESA_PASSKEY=bfb279f9a9b9059b8dcf2906a64c02067ee8359353b32700062f25b89e05C015  # Your passkey

# Callback URL for M-Pesa to notify your backend of payment results
BACKEND_URL=https://your-domain.com
```

### Step 2: Verify Credentials

Visit [Safaricom Developer Portal](https://developer.safaricom.co.ke/) to:
1. Create a developer account (if not already done)
2. Go to **My Apps** → Create a new Lipa Na M-Pesa Online app
3. Get your:
   - **Consumer Key**
   - **Consumer Secret**
   - **Business Shortcode** (paybill number)
   - **Passkey** (STK data encryption key)

### Step 3: Deploy Backend

Deploy your backend with the updated `.env` file. The system will:
- Use `https://api.safaricom.co.ke` for production API calls
- Use `https://sandbox.safaricom.co.ke` for sandbox testing

---

## Technical Details

### How It Works

1. **User initiates payment** → Frontend sends phone number & amount
2. **Backend authenticates** → Uses consumer key/secret to get OAuth token from Daraja
3. **STK Push sent** → M-Pesa prompt pops up on user's phone
4. **User enters PIN** → M-Pesa processes the transaction
5. **Callback received** → Backend receives transaction result if callback URL is valid

### API Endpoints

#### Initiate Payment
```bash
POST /api/payments/mpesa
Content-Type: application/json

{
  "phone": "0712345678",      # Customer phone number
  "amount": 5000,             # Amount in KES
  "accountRef": "BOOKING123",  # Your booking ID
  "description": "Event Booking"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_123456789",
  "responseDescription": "Success. Request accepted for processing",
  "merchantRequestId": "29115011-1234567890"
}
```

#### Callback from Daraja
Daraja will POST to: `{BACKEND_URL}/api/payments/mpesa-callback`

**Callback Data:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "The service request has been accepted successfully",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 5000},
          {"Name": "MpesaReceiptNumber", "Value": "PF2QQK91SL8"},
          {"Name": "TransactionDate", "Value": 20240323121045},
          {"Name": "PhoneNumber", "Value": "254712345678"}
        ]
      }
    }
  }
}
```

---

## Environment Detection

### Automatic Mode Selection

```javascript
// Backend automatically detects based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = isProduction 
  ? 'https://api.safaricom.co.ke'      // PRODUCTION
  : 'https://sandbox.safaricom.co.ke';  // SANDBOX
```

### Testing & Sandbox

**To test in SANDBOX mode:**

1. Keep `NODE_ENV=development` (or anything except 'production')
2. Use sandbox credentials from [Daraja Sandbox](https://sandbox.safaricom.co.ke/)
3. Use test phone numbers (e.g., 254700000000)
4. STK push will appear as a simulated prompt in sandbox

**Sandbox Test Credentials:**
```
Business Shortcode: 174379
Passkey: bfb279f9a9b9059b8dcf2906a64c02067ee8359353b32700062f25b89e05C015
Test Phone: 254700000000
```

---

## Configuration Checklist

- [ ] Create Daraja app at [developer.safaricom.co.ke](https://developer.safaricom.co.ke/)
- [ ] Copy Consumer Key & Consumer Secret
- [ ] Obtain your Business Shortcode (paybill number)
- [ ] Get your Passkey from Daraja dashboard
- [ ] Add credentials to `.env` file
- [ ] Set `NODE_ENV=production` for live M-Pesa
- [ ] Configure `BACKEND_URL` for callbacks (e.g., https://your-domain.com)
- [ ] Deploy backend with updated environment variables
- [ ] Test payment flow end-to-end

---

## Common Issues & Solutions

### Issue: "No access token in response"
**Cause:** Invalid/expired consumer credentials
**Solution:** Verify credentials in [Daraja dashboard](https://developer.safaricom.co.ke/). Make sure they're for a "Lipa Na M-Pesa Online" app.

### Issue: "Invalid phone number format"
**Cause:** Phone number not in correct format
**Solution:** Backend accepts these formats:
- `254712345678` ✅
- `0712345678` ✅ (auto-converted to 254...)
- `+254712345678` ✅

### Issue: Callback not received
**Ensure:**
1. `BACKEND_URL` is publicly accessible (not localhost)
2. Callback endpoint is `/api/payments/mpesa-callback`
3. CORS is properly configured (should accept Daraja IPs)
4. Firewall allows POST requests from Safaricom servers

### Issue: "ResultCode: 1" (User cancelled STK)
This is normal - user denied the payment prompt. Handle gracefully in frontend.

---

## Monitoring & Logging

All M-Pesa operations are logged to console with `[MPESA]` prefix:

```
[MPESA] Initialized in PRODUCTION mode
[MPESA] Base URL: https://api.safaricom.co.ke
[MPESA] Requesting new access token from Daraja
[MPESA] ✅ Access token obtained successfully
[MPESA] Initiating STK push: 254712345678, KES 5000, Ref: BOOKING123
[MPESA] ✅ STK push initiated successfully
[MPESA CALLBACK] ✅ Payment successful!
```

---

## Next Steps

1. **Update `.env`** with production Daraja credentials
2. **Deploy backend** with `NODE_ENV=production`
3. **Test payment** end-to-end
4. **Monitor logs** for payment transactions
5. **Save transaction data** in database when callback is received (currently logs only)

---

## Support

For issues or questions about the Daraja API:
- [Daraja Documentation](https://developer.safaricom.co.ke/docs)
- [Safaricom Developer Support](https://developer.safaricom.co.ke/support)

For Binti Events specific issues:
- Check console logs with `[MPESA]` prefix
- Verify environment variables are set correctly
- Ensure backend is publicly accessible for callbacks
