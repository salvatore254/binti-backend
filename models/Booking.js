/**
 * Booking Model (MongoDB with Mongoose)
 * Defines the Booking schema and data model
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Tent Configuration Schema
 * For storing multiple tent configurations in a single booking
 */
const tentConfigSchema = new mongoose.Schema({
  tentType: {
    type: String,
    enum: ['stretch', 'aframe', 'marquee', 'bell'],
    required: true,
  },
  tentSize: String,
  sections: Number, // For a-frame tents
  quantity: {
    type: Number,
    default: 1,
  },
}, { _id: false });

/**
 * Booking Schema
 * Main booking document structure
 */
const bookingSchema = new mongoose.Schema({
  // Generate our own ID (for compatibility with frontend)
  _id: {
    type: String,
    default: () => uuidv4(),
  },

  // Contact Information
  fullname: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  mpesaPhone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },

  // Tent Configuration
  tentConfigs: [tentConfigSchema],
  tentType: String,
  tentSize: String,
  sections: Number, // For a-frame tents

  // Add-ons
  lighting: {
    type: Boolean,
    default: false,
  },
  transport: {
    type: Boolean,
    default: false,
  },
  pasound: {
    type: Boolean,
    default: false,
  },
  dancefloor: {
    type: Boolean,
    default: false,
  },
  stagepodium: {
    type: Boolean,
    default: false,
  },
  welcomesigns: {
    type: Boolean,
    default: false,
  },
  siteVisit: {
    type: Boolean,
    default: false,
  },
  decor: {
    type: Boolean,
    default: false,
  },

  // Venue and Location
  venue: {
    type: String,
    required: true,
  },
  location: String,

  // Event Details
  eventDate: {
    type: Date,
    required: true,
  },
  setupTime: {
    type: String, // HH:MM format
    required: true,
  },

  // Package Information
  packageName: String,
  packageBasePrice: {
    type: Number,
    default: 0,
  },

  // Additional Info
  additionalInfo: {
    type: String,
    default: '',
  },

  // Pricing
  totalAmount: {
    type: Number,
    required: true,
  },
  depositAmount: Number, // 80% of total
  remainingAmount: Number, // 20% of total
  breakdown: mongoose.Schema.Types.Mixed, // {tent: X, lighting: Y, transport: Z, siteVisit: W}

  // Payment Information
  status: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'pesapal', null],
    default: null,
  },
  transactionId: String,

  // Terms and Conditions
  termsAccepted: {
    type: Boolean,
    default: false,
  },
  termsAcceptedAt: Date,

  // Timestamps (MongoDB auto-managed, but we keep for compatibility)
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
}, {
  collection: 'bookings', // Explicit collection name
  timestamps: { currentTime: () => new Date() }, // Auto-updates updatedAt
});

// Middleware to calculate deposit and remaining amounts before saving
bookingSchema.pre('save', function(next) {
  if (this.totalAmount) {
    this.depositAmount = Math.round(this.totalAmount * 0.8);
    this.remainingAmount = Math.round(this.totalAmount * 0.2);
  }
  next();
});

// Create model
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
