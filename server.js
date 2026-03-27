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

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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
  
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    statusCode,
    stack: err.stack
  });
  
  // ALWAYS set CORS headers on error responses
  res.set('Access-Control-Allow-Origin', origin ? origin : '*');
  res.set('Access-Control-Allow-Credentials', 'true');
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
    
    // Verify SMTP is configured
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;
    if (emailUser && emailPass) {
      console.log('[EMAIL] SMTP configured - Emails enabled');
    } else {
      console.log('[EMAIL] SMTP not configured - Emails will not be sent');
      console.log('[EMAIL] Set EMAIL_USER and EMAIL_PASSWORD in .env to enable');
    }
    
    // Start server immediately (don't wait on DB)
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] Binti backend listening on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('[SERVER] CORS enabled for: https://bintievents.vercel.app');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[SHUTDOWN] SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        try {
          const { closeConnection } = require("./database/connection");
          await closeConnection();
        } catch (e) {
          console.error('[SHUTDOWN] Error closing database:', e.message);
        }
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('[SHUTDOWN] SIGINT received, shutting down gracefully...');
      server.close(async () => {
        try {
          const { closeConnection } = require("./database/connection");
          await closeConnection();
        } catch (e) {
          console.error('[SHUTDOWN] Error closing database:', e.message);
        }
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('[SERVER] Fatal error during initialization:', err.message);
    logger.error('Failed to initialize server: ' + err.message);
    process.exit(1);
  }
};

initializeServer();
