const normalizeId = (value) => String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const buildPublicBookingReference = (bookingId) => {
  const normalizedId = normalizeId(bookingId);
  return `BNT-${(normalizedId || 'PENDING00').slice(0, 8)}`;
};

const buildInvoiceReference = (bookingId) => {
  const normalizedId = normalizeId(bookingId);
  return `INV-${(normalizedId || 'PENDING00').slice(0, 8)}`;
};

module.exports = {
  buildPublicBookingReference,
  buildInvoiceReference,
};