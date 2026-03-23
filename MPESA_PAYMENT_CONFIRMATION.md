# M-Pesa Payment Confirmation Flow

## Overview
When a user completes an M-Pesa payment, the backend receives confirmation from Safaricom's Daraja API and processes it to confirm the booking.

---

## Payment Flow Diagram

```
User                Frontend              Backend              Daraja (M-Pesa)
|                   |                     |                    |
|-- Enter Phone --->|                     |                    |
|                   |--- Initiate STK --->|                    |
|                   |                     |--- Call Daraja --->|
|                   |<-- STK Sent ---<----|                    |<-- STK Pushed
|                   |                     |                    |
|-- Enter PIN ------|--- Waiting... ------|                    |-- Process
|                   |                     |                    |
|                   |-- Waiting... ------|<-- Callback --------|
|                   |                    |                    |
|                   |<-- Confirmed ---<--|--- Update DB ---|
|                   |                    |--- Send Email --|
|                   |                    |
|<- Success Shown -<|<- Success Shown <--|
```

---

## Detailed Steps

### 1️⃣ User Initiates Payment (Frontend)
- User enters M-Pesa phone number
- User checks Terms & Conditions
- User clicks "Proceed to Payment"

### 2️⃣ STK Push Request (Frontend → Backend → Daraja)
```javascript
POST /api/payments/mpesa
{
  phone: "0712345678",
  amount: 5000,
  accountRef: "BOOKING_123",
  description: "Binti Events Booking"
}
```

**Backend Response:**
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_123456789",
  "responseDescription": "Success. Request accepted"
}
```

### 3️⃣ M-Pesa Prompt on Phone
- User's phone receives STK push
- User enters M-Pesa PIN
- M-Pesa processes the transaction

### 4️⃣ Daraja Sends Callback (Daraja → Backend)
```
POST /api/payments/mpesa-callback
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

### 5️⃣ Backend Processes Callback
The backend receives the callback and:

✅ **Validates** the transaction data
✅ **Checks** if resultCode is 0 (success)
✅ **Updates** booking status in database to "paid"
✅ **Saves** M-Pesa receipt number and transaction details
✅ **Sends** confirmation email to customer
✅ **Logs** transaction for accounting

### 6️⃣ Customer Gets Confirmation
- ✉️ Confirmation email with booking details
- 📱 SMS notification (if configured)
- 🌐 Frontend shows success message

---

## Response Status Codes

| ResultCode | Meaning | Action |
|---|---|---|
| 0 | ✅ Success | Payment confirmed, booking saved |
| 1 | ❌ Cancelled | User cancelled STK prompt |
| 2 | ❌ Timeout | User didn't respond in time |
| Other | ❌ Error | Transaction failed |

---

## Backend Implementation Status

### ✅ Implemented
- M-Pesa OAuth authentication with Daraja
- STK push initiation
- Callback parsing and validation
- Comprehensive logging

### ⏳ TODO (Next Phase)
1. **Database Integration**
   - Save transaction details to `payments` table
   - Update `bookings` table `payment_status = 'paid'`
   - Link payment to booking

2. **Email Confirmation**
   - Send HTML email with:
     - Booking confirmation
     - M-Pesa receipt number
     - Event details
     - Payment confirmation

3. **Frontend Polling** (Optional)
   - Implement polling to check payment status every 5 seconds
   - Show real-time confirmation on checkout
   - Alternative: Use WebSockets for push notifications

4. **Error Handling**
   - Handle failed payments
   - Retry logic for failed callbacks
   - Payment dispute handling

5. **Accounting**
   - Record payment in ledger
   - Generate receipts
   - Tax reporting

---

## Current Console Logs

When a payment is received, the backend logs:

```
[MPESA CALLBACK] Received callback from Daraja
[MPESA CALLBACK] Parsed callback: {
  resultCode: 0,
  mpesaReceiptNumber: "PF2QQK91SL8",
  amount: 5000,
  phoneNumber: "254712345678",
  transactionDate: "20240323121045"
}
[MPESA CALLBACK] ✅ Payment successful!
[MPESA CALLBACK] Receipt: PF2QQK91SL8
[MPESA CALLBACK] Amount: 5000
[MPESA CALLBACK] Phone: 254712345678
[MPESA CALLBACK] Payment would be processed and saved to database
[MPESA CALLBACK] Confirmation email would be sent
```

---

## Testing in Sandbox

To test the callback flow in sandbox:

1. **Initiate STK** → Enter test phone number (e.g., 254700000000)
2. **Daraja Test Flow** → Use Daraja console to simulate payment
3. **Check Backend Logs** → See callback received and processed
4. **Verify Data** → Check if transaction data was logged correctly

---

## Frontend Notification (When Implemented)

Once database integration is complete, the frontend will:

1. Poll `/api/payments/status/{checkoutRequestId}` every 5 seconds
2. Receive: `{ status: "paid", receipt: "PF2QQK91SL8" }`
3. Show success modal automatically
4. Clear booking data from localStorage
5. Redirect to home after 3 seconds

---

## Security Notes

- **Callback verification** passwords/signatures should be validated (currently validates structure only)
- **Idempotency** - Callbacks might arrive twice; use receipt number to prevent duplicate bookings
- **Timing** - Callback might take 5-30 seconds after user completes payment
- **Timeout** - Frontend timeout is 2 minutes; Daraja might retry callback up to 10 times

---

## Next Steps for Production

1. Implement database updates in callback handler
2. Integrate email confirmation sending
3. Add frontend polling mechanism
4. Test end-to-end with real M-Pesa credentials
5. Implement receipt/invoice generation
6. Set up accounting records
