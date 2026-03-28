# WhatsApp Integration Setup (Africa's Talking)

## Overview
This backend now includes WhatsApp notifications via Africa's Talking API. Notifications are sent automatically after payment confirmation.

## Features
- **Customer Booking Confirmation**: Detailed booking summary sent to customer's WhatsApp
- **Admin Alert**: New paid booking notification sent to admin
- **Automatic Triggers**: Sent after successful M-Pesa or Pesapal payment

## Environment Variables Required

Add these to your `.env` file:

```bash
# Africa's Talking WhatsApp API
AFRICAS_TALKING_API_KEY=your_api_key_here
AFRICAS_TALKING_USERNAME=sandbox  # Use 'sandbox' for testing, actual username for production

# Admin WhatsApp phone (must be registered with Africa's Talking)
# Format: +254746170866 or 0746170866
ADMIN_WHATSAPP_PHONE=+254746170866
```

## Setup Steps

### 1. Create Africa's Talking Account
1. Go to https://africastalking.com/
2. Sign up for a free account
3. Navigate to the Dashboard

### 2. Activate Sandbox WhatsApp (Testing)
1. In Dashboard → Products → WhatsApp
2. Click "Sandbox" tab
3. Enable Sandbox messaging
4. Get your Sandbox API Key
5. Add test phone numbers (your phone + admin phone)

### 3. Get API Credentials
- **API Key**: Dashboard → Settings → API Key
- **Username**: Your Africa's Talking account username (or 'sandbox')

### 4. Register Phone Numbers (Sandbox)
1. For each phone number that will receive messages:
   - Dashboard → WhatsApp → Sandbox → "Link Phone"
   - Scan QR code with WhatsApp on that phone
   - Confirm verification message

### 5. Set Environment Variables
Create/update `.env` in the backend folder:

```
AFRICAS_TALKING_API_KEY=xxxxxxxxxxxxxxxx
AFRICAS_TALKING_USERNAME=sandbox
ADMIN_WHATSAPP_PHONE=+254746170866
```

### 6. Test the Integration
1. Create a test booking through the frontend
2. Complete payment (M-Pesa/Pesapal)
3. Check:
   - Admin WhatsApp receives booking alert
   - Customer WhatsApp receives booking confirmation
   - Backend logs show `[WHATSAPP]` entries

## Message Format

### Customer Message
Includes:
- Booking ID
- Customer name, phone, email
- Event date, venue, setup time
- Tent selections
- Add-ons selected
- Total amount
- Special requests
- Contact information

### Admin Alert
Includes:
- Booking ID
- Customer details
- Event location and date
- Tent selections
- Payment amount & method
- Transaction ID
- Action reminder

## Troubleshooting

### Messages Not Sending
1. Check environment variables are set: `console.log(process.env.AFRICAS_TALKING_API_KEY)`
2. Verify phone numbers are registered in Africa's Talking sandbox
3. Check backend logs for `[WHATSAPP]` error entries
4. Ensure phone numbers are in correct format: `+254...`

### API Errors
- **401 Unauthorized**: Check API key is correct
- **Invalid phone**: Ensure format is `+254...` or registered in sandbox
- **No connection**: Verify internet connectivity

### Backend Logs
Look for these log patterns:
```
[WHATSAPP] WhatsApp service configured successfully
[WHATSAPP] Sending message to: +254...
[WHATSAPP] Message sent successfully
[MPESA-CALLBACK] WhatsApp sent to customer
[PESAPAL-CALLBACK] WhatsApp alert sent to admin
```

## Production Migration

When moving to production:

1. **Upgrade to Live API**
   - Go to Products → WhatsApp → "Go Live"
   - Submit business details for approval
   - Once approved, get production API key

2. **Update Environment Variables**
   ```bash
   AFRICAS_TALKING_USERNAME=your_live_username  # Not 'sandbox'
   AFRICAS_TALKING_API_KEY=your_live_api_key
   ```

3. **Register Real Phone Numbers**
   - All customer/admin phones must be registered beforehand
   - Current registered: +254728307327 (admin in tents.html), +254746170866 (ADMIN_WHATSAPP_PHONE)

## Code Reference

### WhatsApp Service Location
`/services/WhatsAppService.js`

### Integration Points
1. **M-Pesa Callback**: `/controllers/paymentController.js` - `mpesaCallback()`
2. **Pesapal Callback**: `/controllers/paymentController.js` - `pesapalCallback()`
3. **Email Integration**: Runs in parallel with email notifications

### Service Methods
- `sendMessage(phone, message)` - Send raw message
- `sendBookingConfirmation(booking)` - Customer notification
- `sendAdminAlert(booking)` - Admin notification
- `validateConfig()` - Check credentials on startup

## Notes
- WhatsApp notifications are **non-blocking** (async) - payment still succeeds even if WhatsApp fails
- Messages are **queued** if recipient is offline
- Both **email and WhatsApp** are sent for redundancy
- Service gracefully handles missing API keys (logs warning, continues)

## Support
For Africa's Talking issues: https://africastalking.com/contact
For implementation issues: Check backend logs and WhatsAppService.js error messages
