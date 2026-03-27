# Invoice Service Implementation

## Overview
The Invoice Service automatically generates and sends professional invoices to customers after payment confirmation. Invoices match the Binti Events quote format and are delivered via email.

## Components

### 1. **InvoiceService.js** (`services/InvoiceService.js`)
Main service for generating and sending invoices.

#### Key Methods:
- **`generateInvoiceHTML(booking)`** - Generates formatted HTML invoice based on booking details
- **`generateInvoiceItems(booking)`** - Parses booking breakdown and add-ons into line items
- **`sendInvoice(booking)`** - Sends invoice via email (only if `booking.status === 'paid'`)
- **`processPendingInvoices(Booking)`** - Checks for paid bookings without sent invoices

#### Features:
- Professional HTML/CSS formatting matching Binti Events branding
- Itemized line items (tents, lighting, transport, add-ons)
- Automatic calculation of totals
- Payment confirmation badge with transaction ID
- Terms & conditions included
- Responsive design that works with email clients and printing

#### Example Booking Fields Used:
```javascript
{
  _id: "booking-uuid",
  fullname: "River Cafe",
  venue: "Karura Forest",
  location: "Nairobi",
  email: "customer@example.com",
  phone: "+254722123456",
  eventDate: "2025-06-17T00:00:00Z",
  setupTime: "09:00",
  totalAmount: 67500,
  transactionId: "MPxxxxxxxx",
  status: "paid",
  paymentMethod: "mpesa",
  breakdown: {
    tent: 40000,
    lighting: 14000,
    electrician: 2000,
    transport: 7000,
    smalltent: 2500,
    stringlights: 2000
  }
}
```

### 2. **InvoiceScheduler.js** (`services/InvoiceScheduler.js`)
Background scheduler that ensures no invoices are missed.

#### Key Methods:
- **`start(Booking, intervalSeconds)`** - Start scheduler (default: 300 seconds = 5 minutes)
- **`stop()`** - Stop the scheduler
- **`processNow(Booking)`** - Manually trigger invoice processing

#### Usage:
```javascript
const scheduler = new InvoiceScheduler();
scheduler.start(Booking, 300); // Check for pending invoices every 5 minutes
```

### 3. **Booking Model Updates**
Added two new fields to track invoice delivery:

```javascript
// Invoice Tracking
invoiceSent: {
  type: Boolean,
  default: false,
},
invoiceSentAt: Date,
```

### 4. **Payment Controller Integration**
Modified `controllers/paymentController.js` to trigger invoice sending:

#### M-Pesa Callback (`mpesaCallback`):
```javascript
if (booking) {
  logger.info(`✅ Booking ${booking._id} updated to paid status via M-Pesa`);
  
  // Send invoice asynchronously
  const invoiceService = new InvoiceService();
  invoiceService.sendInvoice(booking).catch(err => {
    logger.error(`Failed to send invoice for booking ${booking._id}: ${err.message}`);
  });
}
```

#### Pesapal Callback (`pesapalCallback`):
Same pattern - invoice sent immediately after payment confirmation.

### 5. **Server Initialization**
Updated `server.js` to start the invoice scheduler on startup:

```javascript
// Initialize Invoice Scheduler (runs every 5 minutes)
const invoiceScheduler = new InvoiceScheduler();
invoiceScheduler.start(Booking, 300);
console.log('[INVOICE SCHEDULER] ✅ Invoice scheduler started');
```

## Invoice Flow

```
Payment Received (M-Pesa/Pesapal)
         ↓
Booking Status Updated to "paid"
         ↓
Payment Controller → InvoiceService.sendInvoice()
         ↓
Generate HTML Invoice
         ↓
Send via Email (EmailService)
         ↓
Mark invoiceSent = true
```

## Invoice Template Features

### Header
- Company logo and branding
- "INVOICE" title
- Invoice number (from booking ID)
- Issue date
- Payment status badge

### Customer Section
- Customer name
- Venue
- Location
- Event date
- Contact information

### Itemized Table
- Description (tents, lighting, transport, add-ons)
- Quantity
- Unit Price (KES)
- Amount (KES)

### Total Section
- Grand total in professional box
- Formatted currency (KES)

### Terms & Conditions
- Standard event policies
- Cancellation terms
- Payment and refund policies
- Liability terms

### Footer
- Issued by signature line
- Thank you message
- Contact information
- Generation timestamp

## Email Delivery

**To:** Customer email from booking
**Subject:** `Invoice - Binti Events (Booking #XXXXXXXX)`
**Content:** 
- Professional greeting
- Event details summary
- Full invoice as HTML
- Contact information
- Company website

Example email body:
```
Dear [Customer Name],

Thank you for your payment! Your invoice for the Binti Events booking is attached below.

Event Details:
- Venue: Karura Forest
- Location: Nairobi
- Event Date: 17 June 2025
- Total Amount Paid: KES 67,500.00
- Transaction ID: MPyyyyyyy

For any questions, please contact us:
📧 bintievents@gmail.com
📱 +254702424242
🌐 www.bintievents.com

Best regards,
Binti Events Team
```

## Configuration

### Email Service
Ensure `.env` has:
```env
EMAIL_USER=bintievents@gmail.com
EMAIL_PASS=your_app_password
```

### Invoice Scheduler Interval
Default: 300 seconds (5 minutes)
Can be changed in `server.js`:
```javascript
invoiceScheduler.start(Booking, 600); // 10 minutes
```

## Error Handling

- **If email sending fails:** Error logged but doesn't break payment flow
- **If scheduler fails:** Warning logged, continues running
- **If booking not found:** Warning logged, payment still confirmed

## Logging

All invoice operations are logged:
```
[INVOICE] Generating invoice for booking ABC123...
[INVOICE] ✅ Invoice sent successfully to customer@email.com
[INVOICE] Failed to send invoice: [error details]
[INVOICE SCHEDULER] Starting invoice scheduler (interval: 300s)
[INVOICE SCHEDULER] Checking for pending invoices...
```

## Testing

### Manual Invoice Sending
```javascript
const InvoiceService = require('./services/InvoiceService');
const Booking = require('./models/Booking');

const service = new InvoiceService();
const booking = await Booking.findById('booking-id');
await service.sendInvoice(booking);
```

### Check Pending Invoices
```javascript
const Booking = require('./models/Booking');
const unpaid = await Booking.find({ 
  status: 'paid', 
  invoiceSent: false 
});
console.log(`Pending invoices: ${unpaid.length}`);
```

## Security & Compliance

- ✅ Only sends invoices for confirmed payments (status = 'paid')
- ✅ Email addresses validated before sending
- ✅ Transaction IDs included for audit trail
- ✅ Professional terms & conditions included
- ✅ Error handling prevents crashes

## Future Enhancements

1. **PDF Generation:** Convert HTML to PDF using puppeteer/wkhtmltopdf
2. **Invoice Numbering:** Add sequential invoice numbers (INV-001, INV-002, etc.)
3. **Recurring Invoices:** Support multi-payment plans
4. **Invoice Archive:** Store sent invoices in database/cloud
5. **Payment Reminders:** Automated reminders for unpaid bookings
6. **Customizable Templates:** Admin panel to customize invoice design
7. **Multi-language:** Support different languages
8. **Receipt Variants:** Different formats for M-Pesa vs Pesapal payments

## Commit History
- **d74da40:** Implement Invoice Service - automatic generation and delivery after payment confirmation
