// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");

// Initialize database and email connections
const { initializeConnection: initializeDatabase } = require("./database/connection");
const logger = require("./utils/logger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Global error handlers for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error(`Uncaught Exception: ${error.message}`);
});

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for separate frontend/backend hosting
const allowedOrigins = [
  "http://localhost:3000",      // Local development frontend (port 3000)
  "http://localhost:5000",      // Local development (same host as backend)
  "http://localhost:5500",      // Live Server port
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5500",      // Live Server port (127.0.0.1 alias)
  "https://bintievents.vercel.app",     // Production frontend (Vercel)
  process.env.FRONTEND_URL,     // Additional URL from environment variable
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy: origin not allowed"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// api routes
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);

// Health check endpoint (useful for deployment verification)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handling middleware (MUST be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const initializeServer = async () => {
  try {
    // Initialize MongoDB connection
    await initializeDatabase();
    logger.info('MongoDB connected');
    
    // Verify SMTP is configured
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (emailUser && emailPass) {
      console.log('[EMAIL]  SMTP configured - Emails enabled');
    } else {
      console.log('[EMAIL]  SMTP not configured - Emails will not be sent');
      console.log('[EMAIL] Set EMAIL_USER and EMAIL_PASS in .env to enable');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(` Binti backend listening at http://localhost:${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Database: MongoDB @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log(' SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        const { closeConnection } = require("./database/connection");
        await closeConnection();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log(' SIGINT received, shutting down gracefully...');
      server.close(async () => {
        const { closeConnection } = require("./database/connection");
        await closeConnection();
        process.exit(0);
      });
    });

  } catch (err) {
    logger.error(' Failed to initialize server:', err);
    process.exit(1);
  }
};

initializeServer();
