/**
 * Environment Configuration
 * Manages all environment variables and configuration settings
 */

require('dotenv').config({ override: true });

const config = {
  // Server
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  
  // Database (PostgreSQL)
  DATABASE_URL: process.env.DATABASE_URL,
  PGHOST: process.env.PGHOST,
  PGPORT: process.env.PGPORT,
  PGDATABASE: process.env.PGDATABASE,
  PGUSER: process.env.PGUSER,
  PGPASSWORD: process.env.PGPASSWORD,
  DB_SSL: process.env.DB_SSL === 'true',
  
  // Payment Providers
  PESAPAL_CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET,
  PESAPAL_MERCHANT_REFERENCE: process.env.PESAPAL_MERCHANT_REFERENCE,
  PESAPAL_REDIRECT_URL: process.env.PESAPAL_REDIRECT_URL,
  PESAPAL_USE_SANDBOX: process.env.PESAPAL_USE_SANDBOX,
  
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
  MPESA_PASSKEY: process.env.MPESA_PASSKEY,
  MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
  MPESA_USE_SANDBOX: process.env.MPESA_USE_SANDBOX,
  MPESA_PROVIDER: process.env.MPESA_PROVIDER,

  MEXPRESS_BASE_URL: process.env.MEXPRESS_BASE_URL,
  MEXPRESS_PUBLIC_KEY: process.env.MEXPRESS_PUBLIC_KEY,
  MEXPRESS_SECRET_KEY: process.env.MEXPRESS_SECRET_KEY,
  MEXPRESS_RETURN_URL: process.env.MEXPRESS_RETURN_URL,
  MEXPRESS_WEBHOOK_URL: process.env.MEXPRESS_WEBHOOK_URL,
  
  // Email Configuration
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  
  // Application URLs
  APP_URL: process.env.APP_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

module.exports = config;
