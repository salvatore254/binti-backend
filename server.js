// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
// Use Express native body parsing (instead of body-parser package)
const cors = require("cors");

const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");

// Initialize database and email connections
const { initializeConnection: initializeDatabase } = require("./database/connection");
const logger = require("./utils/logger");
const InvoiceScheduler = require("./services/InvoiceScheduler");
const Booking = require("./models/Booking");

// Global error handlers for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  console.error(' Uncaught Exception:', error);
  logger.error(`Uncaught Exception: ${error.message}`);
});

const app = express();
const PORT = process.env.PORT || 5000;
const testEndpointsEnabled = process.env.ENABLE_TEST_ENDPOINTS === 'true';

// DEBUG: Log every incoming request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// CORS configuration - allow frontend and development origins
const whitelist = [
  'https://bintievents.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:8000'
];

const resolveAllowedOrigin = (origin) => {
  if (!origin) {
    return null;
  }

  return whitelist.includes(origin) ? origin : null;
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) {
      console.log('[CORS] No origin header - allowing request');
      callback(null, true);
    } else if (resolveAllowedOrigin(origin)) {
      console.log(`[CORS] Origin allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`[CORS] Origin rejected: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

// Core middleware (must not throw errors)
app.use(cors(corsOptions));

// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Body parsing with size limits (using Express native parsers)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));


// api routes
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  try {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[HEALTH] Error:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
});

// Test email endpoint (development only)
app.post("/api/test-email", async (req, res) => {
  if (!testEndpointsEnabled) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }

  try {
    const { email, testType = 'booking' } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email address required" });
    }

    const EmailService = require("./services/EmailService");
    const emailService = EmailService();

    let result;
    
    if (testType === 'booking') {
      const testBooking = {
        _id: 'TEST_' + Date.now(),
        fullname: 'Test Customer',
        phone: '+254700000000',
        email: email,
        venue: 'Test Venue',
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        setupTime: '08:00',
        totalAmount: 50000
      };
      result = await emailService.sendBookingConfirmation(testBooking);
    } 
    else if (testType === 'payment') {
      const testBooking = {
        _id: 'TEST_' + Date.now(),
        fullname: 'Test Customer',
        phone: '+254700000000',
        email: email,
        venue: 'Test Venue',
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: 50000
      };
      result = await emailService.sendPaymentConfirmation(testBooking, 'TEST123456789');
    }
    else if (testType === 'invoice') {
      const testBooking = {
        _id: 'TEST_' + Date.now(),
        fullname: 'Test Customer',
        phone: '+254700000000',
        email: email,
        venue: 'Test Venue',
        location: 'Nairobi, Kenya',
        eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        setupTime: '08:00',
        totalAmount: 50000,
        status: 'paid',
        transactionId: 'TEST123456789',
        breakdown: { tent: 35000, lighting: 8000, transport: 7000 },
      };
      const InvoiceService = require('./services/InvoiceService');
      const invoiceService = new InvoiceService();
      const sent = await invoiceService.sendInvoice(testBooking);
      result = { success: sent, messageId: sent ? 'invoice-sent' : null, error: sent ? null : 'Invoice send failed' };
    }
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test ${testType} email sent successfully to ${email}`,
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: `Failed to send test email: ${result.error}` 
      });
    }
  } catch (err) {
    console.error("[TEST-EMAIL] Error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// Root route - API info
app.get("/", (req, res) => {
  res.json({
    name: "Binti Events Backend API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/health",
      bookings: "/api/bookings",
      payments: "/api/payments",
      contact: "/api/contact"
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res, next) => {
  console.log(`[404] ${req.method} ${req.path}`);
  const err = new Error(`Route not found: ${req.method} ${req.path}`);
  err.statusCode = 404;
  next(err);  // Pass to error handler instead of responding directly
});

// Error handling middleware - MUST be last middleware and have 4 parameters
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const origin = req.get('Origin');
  const allowedOrigin = resolveAllowedOrigin(origin);
  
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    statusCode,
    stack: err.stack
  });
  
  if (allowedOrigin) {
    res.set('Access-Control-Allow-Origin', allowedOrigin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
const initializeServer = async () => {
  try {
    console.log('[SERVER] Starting initialization...');
    
    // Initialize MongoDB connection
    try {
      await initializeDatabase();
      logger.info('MongoDB connected');
      console.log('[DB] MongoDB connection successful');
    } catch (dbErr) {
      console.error('[DB] MongoDB connection failed:', dbErr.message);
      console.log('[DB] WARNING: Continuing without database - API will still work');
      logger.error('MongoDB connection failed: ' + dbErr.message);
    }
    
    // Verify Resend is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (resendApiKey) {
      console.log('[EMAIL] Resend configured - Emails enabled');
    } else {
      console.log('[EMAIL] Resend not configured - Emails will not be sent');
      console.log('[EMAIL] Set RESEND_API_KEY in .env to enable');
    }

    if (!adminEmail) {
      console.log('[EMAIL] ADMIN_EMAIL not configured - Admin notifications are disabled');
    }

    // Verify WhatsApp is configured via Africa's Talking
    const africasTalkingApiKey = process.env.AFRICAS_TALKING_API_KEY;
    const adminWhatsAppPhone = process.env.ADMIN_WHATSAPP_PHONE;
    if (africasTalkingApiKey && adminWhatsAppPhone) {
      console.log('[WHATSAPP] Africa\'s Talking configured - WhatsApp notifications enabled');
    } else {
      console.log('[WHATSAPP] Africa\'s Talking not configured - WhatsApp notifications disabled');
      if (!africasTalkingApiKey) console.log('[WHATSAPP] Set AFRICAS_TALKING_API_KEY in .env to enable');
      if (!adminWhatsAppPhone) console.log('[WHATSAPP] Set ADMIN_WHATSAPP_PHONE in .env to enable');
    }

    // Initialize Invoice Scheduler (runs every 5 minutes to check for pending invoices)
    try {
      const invoiceScheduler = new InvoiceScheduler();
      invoiceScheduler.start(Booking, 300); // Check every 5 minutes (300 seconds)
      console.log('[INVOICE SCHEDULER] Invoice scheduler started');
    } catch (schedulerErr) {
      console.warn('[INVOICE SCHEDULER] Failed to start scheduler:', schedulerErr.message);
      logger.warn('Invoice scheduler initialization failed: ' + schedulerErr.message);
      // Continue anyway - invoices will still be sent on payment callback
    }
    
    // Start server immediately (don't wait on DB)
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] Binti backend listening on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('[SERVER] CORS enabled for: https://bintievents.vercel.app');
    });
  } catch (err) {
    console.error('[SERVER] Failed to start:', err.message);
    logger.error('Failed to start server: ' + err.message);
    process.exit(1);
  }
};

// Initialize and start the server
initializeServer();


