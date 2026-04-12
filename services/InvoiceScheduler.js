/**
 * Invoice Scheduler
 * Processes pending invoices periodically to ensure they're all sent
 * Run this via a cron job or call it from server startup
 */

const InvoiceService = require('./InvoiceService');
const logger = require('../utils/logger');

class InvoiceScheduler {
  constructor() {
    this.invoiceService = new InvoiceService();
    this.isRunning = false;
    this.interval = null;
  }

  /**
   * Start the scheduler to process invoices every X seconds
   * @param {number} intervalSeconds - How often to check for pending invoices (default: 300 = 5 minutes)
    * @param {Object} bookingRepository - Booking repository instance
   */
    start(bookingRepository, intervalSeconds = 300) {
    if (this.isRunning) {
      console.log('[INVOICE SCHEDULER] Already running');
      return;
    }

    console.log(`[INVOICE SCHEDULER] Starting invoice scheduler (interval: ${intervalSeconds}s)`);
    this.isRunning = true;

    // Run immediately on start
    this.invoiceService.processPendingInvoices(bookingRepository);

    // Then run at regular intervals
    this.interval = setInterval(() => {
      this.invoiceService.processPendingInvoices(bookingRepository);
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('[INVOICE SCHEDULER] Stopped');
    }
  }

  /**
   * Manually trigger invoice processing
   * @param {Object} bookingRepository - Booking repository instance
   */
  async processNow(bookingRepository) {
    console.log('[INVOICE SCHEDULER] Manual trigger: processing pending invoices...');
    await this.invoiceService.processPendingInvoices(bookingRepository);
  }
}

module.exports = InvoiceScheduler;
