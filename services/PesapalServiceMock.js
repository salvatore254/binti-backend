/**
 * Mock Pesapal Service for Local Development
 * Simulates Pesapal API responses without requiring network access
 * Use this when you cannot reach sandbox.pesapal.com for testing
 */

class PesapalServiceMock {
  constructor() {
    this.mockOrders = {};
    console.log('[PESAPAL-MOCK] Initialized - Using mock Pesapal service for testing');
  }

  /**
   * Mock access token retrieval
   */
  async getAccessToken() {
    console.log('[PESAPAL-MOCK] Returning mock access token');
    // Simulate a real Pesapal token
    return 'mock_token_' + Date.now();
  }

  /**
   * Mock payment order creation
   */
  async createOrder(orderData) {
    const {
      amount,
      currency = 'KES',
      orderRef,
      description,
      email,
      phone,
      firstName = 'Customer',
      lastName = 'Name'
    } = orderData;

    console.log('[PESAPAL-MOCK] Creating mock payment order:', {
      amount,
      currency,
      orderRef,
      email
    });

    // Generate a mock order tracking ID
    const orderTrackingId = 'MOCK_ORDER_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Generate a mock iframe URL (this won't actually work, but simulates the flow)
    const iframeUrl = `https://sandbox.pesapal.com/api/querypaymentstatus?ref=${orderTrackingId}&merchant=BINTI`;

    // Store in mock order cache
    this.mockOrders[orderRef] = {
      orderTrackingId,
      amount,
      currency,
      email,
      phone,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    console.log('[PESAPAL-MOCK] Mock order created:', {
      orderTrackingId,
      orderRef,
      iframeUrl
    });

    return {
      success: true,
      orderTrackingId,
      iframe_url: iframeUrl,
      responseCode: 0,
      responseMessage: 'Mock order created successfully'
    };
  }

  /**
   * Mock payment status query
   */
  async getPaymentStatus(orderRef, orderTrackingId) {
    console.log('[PESAPAL-MOCK] Querying mock payment status:', {
      orderRef,
      orderTrackingId
    });

    const mockOrder = this.mockOrders[orderRef];
    if (!mockOrder) {
      console.log('[PESAPAL-MOCK] Order not found, returning pending status');
      return {
        orderTrackingId,
        status: 'PENDING',
        statusCode: '01',
        statusMessage: 'Payment pending (mock)'
      };
    }

    return {
      orderTrackingId: mockOrder.orderTrackingId,
      amount: mockOrder.amount,
      currency: mockOrder.currency,
      status: mockOrder.status,
      statusCode: mockOrder.status === 'COMPLETED' ? '00' : '01',
      statusMessage: mockOrder.status === 'COMPLETED' ? 'Payment completed' : 'Payment pending',
      paymentMethod: 'MOCK',
      transactionDate: new Date().toISOString()
    };
  }

  /**
   * Mark a mock order as completed (for testing)
   */
  markOrderAsCompleted(orderRef) {
    if (this.mockOrders[orderRef]) {
      this.mockOrders[orderRef].status = 'COMPLETED';
      console.log('[PESAPAL-MOCK] Marked order as completed:', orderRef);
    }
  }

  /**
   * Clear all mock orders (for testing)
   */
  clearMockOrders() {
    this.mockOrders = {};
    console.log('[PESAPAL-MOCK] Cleared all mock orders');
  }

  /**
   * Get all mock orders (for debugging)
   */
  getMockOrders() {
    return this.mockOrders;
  }
}

module.exports = PesapalServiceMock;
