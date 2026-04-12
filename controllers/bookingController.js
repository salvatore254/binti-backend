/**
 * Booking Controller
 * Handles booking-related requests and business logic
 */

const response = require('../utils/response');
const logger = require('../utils/logger');
const { validateBookingData } = require('../validators/bookingValidator');
const bookingRepository = require('../repositories/bookingRepository');

/**
 * Create a new booking
 * POST /api/bookings
 */
const createBooking = async (req, res, next) => {
  try {
    const { fullname, phone, email, tentType, location, mpesaPhone, breakdown, totalAmount, termsAccepted } = req.body;

    // Validate booking data
    const validation = validateBookingData({
      fullname,
      phone,
      email,
      tentType,
      location,
    });

    if (!validation.isValid) {
      return response.validationError(res, validation.errors);
    }

    // Create booking document
    const bookingData = {
      fullname,
      phone,
      mpesaPhone: mpesaPhone || phone,
      email,
      tentType,
      location,
      venue: location,
      breakdown,
      totalAmount,
      termsAccepted,
      termsAcceptedAt: termsAccepted ? new Date() : null,
      status: 'pending',
    };

    const booking = await bookingRepository.create(bookingData);

    logger.info(`New booking created: ${booking._id} for ${fullname}`);

    return response.success(res, {
      bookingId: booking._id,
      fullname: booking.fullname,
      email: booking.email,
      totalAmount: booking.totalAmount,
      depositAmount: booking.depositAmount,
      status: booking.status,
    }, 'Booking created successfully', 201);
  } catch (err) {
    logger.error('Error creating booking', err);
    return response.error(res, 'Failed to create booking', 500);
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
const getBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await bookingRepository.findById(id);

    if (!booking) {
      return response.error(res, 'Booking not found', 404);
    }

    logger.info(`Retrieved booking: ${id}`);

    return response.success(res, booking, 'Booking retrieved successfully');
  } catch (err) {
    logger.error('Error retrieving booking', err);
    return response.error(res, 'Failed to retrieve booking', 500);
  }
};

/**
 * Get all bookings with pagination
 * GET /api/bookings?page=1&limit=10
 */
const getAllBookings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { bookings, total } = await bookingRepository.findPaginated(page, limit);

    logger.info(`Retrieved ${bookings.length} bookings (page ${page})`);

    return response.paginated(res, bookings, total, page, limit, 'Bookings retrieved successfully');
  } catch (err) {
    logger.error('Error retrieving bookings', err);
    return response.error(res, 'Failed to retrieve bookings', 500);
  }
};

/**
 * Update booking
 * PUT /api/bookings/:id
 */
const updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const booking = await bookingRepository.updateById(id, updateData);

    if (!booking) {
      return response.error(res, 'Booking not found', 404);
    }

    logger.info(`Booking ${id} updated`);

    return response.success(res, booking, 'Booking updated successfully');
  } catch (err) {
    logger.error('Error updating booking', err);
    return response.error(res, 'Failed to update booking', 500);
  }
};

/**
 * Cancel booking
 * DELETE /api/bookings/:id
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await bookingRepository.updateById(id, { status: 'cancelled' });

    if (!booking) {
      return response.error(res, 'Booking not found', 404);
    }

    logger.info(`Booking ${id} cancelled`);

    return response.success(res, {}, 'Booking cancelled successfully');
  } catch (err) {
    logger.error('Error cancelling booking', err);
    return response.error(res, 'Failed to cancel booking', 500);
  }
};

module.exports = {
  createBooking,
  getBooking,
  getAllBookings,
  updateBooking,
  cancelBooking,
};
