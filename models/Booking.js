/**
 * Booking Model
 * Defines the Booking data model and related methods
 */

class Booking {
  constructor(data) {
    this.id = data.id;
    this.fullname = data.fullname;
    this.phone = data.phone;
    this.email = data.email;
    this.tentType = data.tentType;
    this.tentSize = data.tentSize;
    this.lighting = data.lighting || false;
    this.transport = data.transport || false;
    this.siteVisit = data.siteVisit || false;
    this.decor = data.decor || false;
    this.venue = data.venue;
    this.totalAmount = data.totalAmount;
    this.breakdown = data.breakdown; // JSON {tent, lighting, transport, siteVisit}
    this.status = data.status || 'pending'; // pending, paid, completed, cancelled
    this.paymentMethod = data.paymentMethod; // mpesa, pesapal
    this.transactionId = data.transactionId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Convert model to plain object for responses
   */
  toJSON() {
    return {
      id: this.id,
      fullname: this.fullname,
      phone: this.phone,
      email: this.email,
      tentType: this.tentType,
      tentSize: this.tentSize,
      addOns: {
        lighting: this.lighting,
        transport: this.transport,
        siteVisit: this.siteVisit,
        decor: this.decor,
      },
      venue: this.venue,
      totalAmount: this.totalAmount,
      breakdown: this.breakdown,
      status: this.status,
      paymentMethod: this.paymentMethod,
      transactionId: this.transactionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Get booking summary
   */
  getSummary() {
    return {
      bookingId: this.id,
      customer: this.fullname,
      tent: this.tentType,
      venue: this.venue,
      amount: this.totalAmount,
      status: this.status,
    };
  }
}

module.exports = Booking;
