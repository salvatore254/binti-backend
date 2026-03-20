/**
 * Booking Controller
 * Handles booking-related requests and business logic
 */

const response = require('../utils/response');
const logger = require('../utils/logger');
const { validateBookingData } = require('../validators/bookingValidator');

/**
 * Create a new booking
 * POST /api/bookings
 */
const createBooking = async (req, res, next) => {
  try {
    const { fullname, phone, email, tentType, location, breakdown } = req.body;

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

    // TODO: Save booking to database
    // const booking = await BookingService.create({...});

    logger.info(`New booking created for ${fullname}`);

    return response.success(res, {
      bookingId: 'BINTI-' + Date.now(),
      // ...booking data
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

    // TODO: Fetch from database
    // const booking = await BookingService.getById(id);

    // if (!booking) {
    //   return response.error(res, 'Booking not found', 404);
    // }

    return response.success(res, {}, 'Booking retrieved successfully');
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

    // TODO: Fetch from database
    // const bookings = await BookingService.getAll(page, limit);

    return response.paginated(res, [], 0, page, limit, 'Bookings retrieved successfully');
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

    // TODO: Update in database
    // const booking = await BookingService.update(id, updateData);

    logger.info(`Booking ${id} updated`);

    return response.success(res, {}, 'Booking updated successfully');
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

    // TODO: Cancel in database
    // const booking = await BookingService.cancel(id);

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
