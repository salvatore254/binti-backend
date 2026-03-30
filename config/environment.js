/**
 * Environment Configuration
 * Manages all environment variables and configuration settings
 */

require('dotenv').config();

const config = {
  // Server
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  
  // Database (MongoDB)
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  
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
  
  // Email Configuration
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  
  // Application URLs
  APP_URL: process.env.APP_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

module.exports = config;
