const { v4: uuidv4 } = require('uuid');
const { query } = require('../database/connection');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const removeUndefinedValues = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (entryValue !== undefined) {
      accumulator[key] = entryValue;
    }
    return accumulator;
  }, {});
};

const normalizeTentConfigs = (tentConfigs) => {
  if (!Array.isArray(tentConfigs)) {
    return tentConfigs;
  }

  return tentConfigs.map((config) => removeUndefinedValues({
    tentType: config.tentType || config.type || 'stretch',
    tentSize: config.tentSize || config.size,
    sections: config.sections,
    config: config.config,
    quantity: config.quantity || 1,
    color: config.color,
  }));
};

const applyDerivedFields = (payload) => {
  const normalized = removeUndefinedValues({ ...payload });

  if (normalized.id && !normalized._id) {
    normalized._id = normalized.id;
  }

  delete normalized.id;

  if (normalized.tentConfigs) {
    normalized.tentConfigs = normalizeTentConfigs(normalized.tentConfigs);
  }

  if (normalized.totalAmount !== undefined && normalized.totalAmount !== null) {
    normalized.depositAmount = Math.round(Number(normalized.totalAmount) * 0.8);
    normalized.remainingAmount = Math.round(Number(normalized.totalAmount) * 0.2);
  }

  return normalized;
};

const numberFields = new Set([
  'package_base_price',
  'total_amount',
  'deposit_amount',
  'remaining_amount',
  'payment_failure_code',
  'sections',
]);

const relationalKeys = new Set(['tentConfigs', 'breakdown']);

const fieldMap = {
  _id: 'id',
  id: 'id',
  fullname: 'fullname',
  phone: 'phone',
  mpesaPhone: 'mpesa_phone',
  email: 'email',
  tentType: 'tent_type',
  tentSize: 'tent_size',
  sections: 'sections',
  lighting: 'lighting',
  transportArrangement: 'transport_arrangement',
  transportVenue: 'transport_venue',
  pasound: 'pasound',
  dancefloor: 'dancefloor',
  stagepodium: 'stagepodium',
  welcomesigns: 'welcomesigns',
  siteVisit: 'site_visit',
  decor: 'decor',
  venue: 'venue',
  location: 'location',
  setupTime: 'setup_time',
  eventDate: 'event_date',
  packageName: 'package_name',
  packageBasePrice: 'package_base_price',
  additionalInfo: 'additional_info',
  totalAmount: 'total_amount',
  depositAmount: 'deposit_amount',
  remainingAmount: 'remaining_amount',
  status: 'status',
  paymentMethod: 'payment_method',
  transactionId: 'transaction_id',
  checkoutRequestId: 'checkout_request_id',
  pesapalOrderRef: 'pesapal_order_ref',
  pesapalOrderTrackingId: 'pesapal_order_tracking_id',
  paymentFailureReason: 'payment_failure_reason',
  paymentFailureCode: 'payment_failure_code',
  lastPaymentAttempt: 'last_payment_attempt',
  lastPaymentError: 'last_payment_error',
  invoiceSent: 'invoice_sent',
  invoiceSentAt: 'invoice_sent_at',
  termsAccepted: 'terms_accepted',
  termsAcceptedAt: 'terms_accepted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const columnToProperty = Object.entries(fieldMap).reduce((accumulator, [property, column]) => {
  if (!accumulator[column] || property === '_id') {
    accumulator[column] = property;
  }

  return accumulator;
}, {});

const normalizeDbValue = (column, value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (numberFields.has(column)) {
    return Number(value);
  }

  return value;
};

const toTentConfigRecord = (row) => removeUndefinedValues({
  tentType: row.tent_type,
  tentSize: row.tent_size,
  sections: row.sections,
  config: row.config_value,
  quantity: Number(row.quantity || 1),
  color: row.color,
});

const toBreakdownRecord = (rows) => {
  if (!rows || rows.length === 0) {
    return {};
  }

  const breakdown = {};
  const tentConfigurations = [];

  rows.forEach((row) => {
    const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);

    if (row.item_key === 'package' && row.item_type === 'package') {
      breakdown.package = removeUndefinedValues({
        name: row.label || 'Selected Package',
        basePrice: amount || 0,
      });
      return;
    }

    if (row.item_key === 'tent') {
      if (row.item_type === 'tent_config') {
        tentConfigurations.push(removeUndefinedValues({
          type: row.tent_type,
          tentType: row.tent_type,
          size: row.tent_size,
          tentSize: row.tent_size,
          sections: row.sections,
          config: row.config_value,
          color: row.color,
          quantity: Number(row.quantity || 1),
          cost: amount || 0,
        }));
        return;
      }

      if (row.item_type === 'package_included') {
        breakdown.tent = { type: 'package-included', cost: 0 };
        return;
      }

      if (row.item_type === 'tent_summary') {
        breakdown.tent = removeUndefinedValues({
          type: row.tent_type,
          size: row.tent_size,
          sections: row.sections,
          config: row.config_value,
          color: row.color,
          cost: amount || 0,
          count: row.item_count === null || row.item_count === undefined ? undefined : Number(row.item_count),
        });
      }
      return;
    }

    if (row.item_key === 'transport' && row.item_type === 'transport') {
      const zoneInfo = removeUndefinedValues({
        cost: amount || 0,
        region: row.region,
        distance: row.distance,
        description: row.description_text,
        confidence: row.confidence,
      });

      breakdown.transport = removeUndefinedValues({
        cost: amount || 0,
        zone: row.zone_name,
        serviceArea: row.service_area,
        arrangement: row.arrangement,
        zoneInfo: Object.keys(zoneInfo).length > 0 ? zoneInfo : undefined,
      });
      return;
    }

    if (row.item_type === 'amount') {
      breakdown[row.item_key] = amount || 0;
      return;
    }

    if (row.item_type === 'text') {
      breakdown[row.item_key] = row.description_text || row.label || '';
    }
  });

  if (tentConfigurations.length > 0) {
    breakdown.tent = {
      type: 'multi-config',
      configurations: tentConfigurations,
      cost: tentConfigurations.reduce((total, item) => total + Number(item.cost || 0), 0),
      count: tentConfigurations.length,
    };
  }

  return breakdown;
};

const toBookingRecord = (row, tentConfigRows = [], breakdownRows = []) => {
  if (!row) {
    return null;
  }

  const record = {};

  for (const [column, value] of Object.entries(row)) {
    const property = columnToProperty[column];
    if (property) {
      record[property] = normalizeDbValue(column, value);
    }
  }

  const id = record._id || record.id || row.id;

  return {
    id,
    _id: id,
    ...record,
    tentConfigs: tentConfigRows.map(toTentConfigRecord),
    breakdown: toBreakdownRecord(breakdownRows),
  };
};

const buildColumnValuePairs = (payload) => {
  const normalized = applyDerivedFields(payload);

  return Object.entries(normalized).reduce((accumulator, [key, value]) => {
    const column = fieldMap[key];
    if (column && value !== undefined && !relationalKeys.has(key)) {
      accumulator.push([column, value]);
    }
    return accumulator;
  }, []);
};

const buildUpdateStatement = (pairs, startingIndex = 1) => {
  return pairs.map(([column], index) => `${column} = $${index + startingIndex}`).join(', ');
};

const createTentConfigRows = (bookingId, tentConfigs = []) => tentConfigs.map((config, index) => ({
  booking_id: bookingId,
  tent_type: config.tentType || config.type || 'stretch',
  tent_size: config.tentSize || config.size || null,
  sections: config.sections ?? null,
  config_value: config.config ?? null,
  quantity: Number(config.quantity || 1),
  color: config.color ?? null,
  sort_order: index,
}));

const createBreakdownRows = (bookingId, breakdown = {}) => {
  const rows = [];

  if (breakdown.package && typeof breakdown.package === 'object') {
    rows.push({
      booking_id: bookingId,
      item_key: 'package',
      item_type: 'package',
      label: breakdown.package.name || 'Selected Package',
      amount: Number(breakdown.package.basePrice || 0),
      quantity: 1,
      sort_order: rows.length,
    });
  }

  if (breakdown.tent && typeof breakdown.tent === 'object') {
    if (Array.isArray(breakdown.tent.configurations) && breakdown.tent.configurations.length > 0) {
      breakdown.tent.configurations.forEach((tent) => {
        rows.push({
          booking_id: bookingId,
          item_key: 'tent',
          item_type: 'tent_config',
          amount: Number(tent.cost || 0),
          quantity: Number(tent.quantity || 1),
          tent_type: tent.tentType || tent.type || null,
          tent_size: tent.tentSize || tent.size || null,
          sections: tent.sections ?? null,
          config_value: tent.config ?? null,
          color: tent.color ?? null,
          sort_order: rows.length,
        });
      });
    } else if (breakdown.tent.type === 'package-included') {
      rows.push({
        booking_id: bookingId,
        item_key: 'tent',
        item_type: 'package_included',
        amount: 0,
        quantity: 1,
        sort_order: rows.length,
      });
    } else {
      rows.push({
        booking_id: bookingId,
        item_key: 'tent',
        item_type: 'tent_summary',
        amount: Number(breakdown.tent.cost || 0),
        quantity: 1,
        tent_type: breakdown.tent.tentType || breakdown.tent.type || null,
        tent_size: breakdown.tent.tentSize || breakdown.tent.size || null,
        sections: breakdown.tent.sections ?? null,
        config_value: breakdown.tent.config ?? null,
        color: breakdown.tent.color ?? null,
        item_count: breakdown.tent.count ?? null,
        sort_order: rows.length,
      });
    }
  }

  Object.entries(breakdown).forEach(([key, value]) => {
    if (key === 'package' || key === 'tent' || key === 'transport') {
      return;
    }

    if (typeof value === 'number') {
      rows.push({
        booking_id: bookingId,
        item_key: key,
        item_type: 'amount',
        amount: Number(value),
        quantity: 1,
        sort_order: rows.length,
      });
      return;
    }

    if (typeof value === 'string') {
      rows.push({
        booking_id: bookingId,
        item_key: key,
        item_type: 'text',
        description_text: value,
        sort_order: rows.length,
      });
    }
  });

  if (breakdown.transport !== undefined) {
    if (typeof breakdown.transport === 'number') {
      rows.push({
        booking_id: bookingId,
        item_key: 'transport',
        item_type: 'transport',
        amount: Number(breakdown.transport),
        quantity: 1,
        sort_order: rows.length,
      });
    } else if (breakdown.transport && typeof breakdown.transport === 'object') {
      const zoneInfo = breakdown.transport.zoneInfo || {};
      rows.push({
        booking_id: bookingId,
        item_key: 'transport',
        item_type: 'transport',
        amount: Number(breakdown.transport.cost || 0),
        quantity: 1,
        zone_name: breakdown.transport.zone || null,
        service_area: breakdown.transport.serviceArea || null,
        arrangement: breakdown.transport.arrangement || null,
        region: zoneInfo.region || null,
        distance: zoneInfo.distance || null,
        confidence: zoneInfo.confidence || null,
        description_text: zoneInfo.description || null,
        sort_order: rows.length,
      });
    }
  }

  return rows;
};

const insertRows = async (tableName, rows) => {
  if (!rows || rows.length === 0) {
    return;
  }

  const columns = Array.from(rows.reduce((accumulator, row) => {
    Object.keys(row).forEach((column) => accumulator.add(column));
    return accumulator;
  }, new Set()));
  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowPlaceholders = columns.map((column, columnIndex) => {
      values.push(hasOwn(row, column) ? row[column] : null);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${rowPlaceholders.join(', ')})`;
  }).join(', ');

  await query(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`,
    values
  );
};

const fetchTentConfigs = async (bookingIds) => {
  if (!bookingIds.length) {
    return new Map();
  }

  const result = await query(
    'SELECT * FROM booking_tent_configs WHERE booking_id = ANY($1::uuid[]) ORDER BY sort_order ASC',
    [bookingIds]
  );

  return result.rows.reduce((accumulator, row) => {
    const key = row.booking_id;
    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }
    accumulator.get(key).push(row);
    return accumulator;
  }, new Map());
};

const fetchBreakdownItems = async (bookingIds) => {
  if (!bookingIds.length) {
    return new Map();
  }

  const result = await query(
    'SELECT * FROM booking_breakdown_items WHERE booking_id = ANY($1::uuid[]) ORDER BY sort_order ASC',
    [bookingIds]
  );

  return result.rows.reduce((accumulator, row) => {
    const key = row.booking_id;
    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }
    accumulator.get(key).push(row);
    return accumulator;
  }, new Map());
};

const hydrateBookings = async (rows) => {
  if (!rows.length) {
    return [];
  }

  const bookingIds = rows.map((row) => row.id);
  const [tentConfigMap, breakdownMap] = await Promise.all([
    fetchTentConfigs(bookingIds),
    fetchBreakdownItems(bookingIds),
  ]);

  return rows.map((row) => toBookingRecord(
    row,
    tentConfigMap.get(row.id) || [],
    breakdownMap.get(row.id) || []
  ));
};

const replaceTentConfigs = async (bookingId, tentConfigs) => {
  await query('DELETE FROM booking_tent_configs WHERE booking_id = $1', [bookingId]);
  await insertRows('booking_tent_configs', createTentConfigRows(bookingId, tentConfigs));
};

const replaceBreakdownItems = async (bookingId, breakdown) => {
  await query('DELETE FROM booking_breakdown_items WHERE booking_id = $1', [bookingId]);
  await insertRows('booking_breakdown_items', createBreakdownRows(bookingId, breakdown));
};

class BookingRepository {
  async create(payload) {
    const createPayload = applyDerivedFields({
      _id: payload._id || payload.id || uuidv4(),
      createdAt: payload.createdAt || new Date(),
      updatedAt: payload.updatedAt || new Date(),
      ...payload,
    });

    if (createPayload.paymentMethod === 'mpesa' && !String(createPayload.mpesaPhone || '').trim()) {
      throw new Error('mpesaPhone is required for M-Pesa payments');
    }

    const pairs = buildColumnValuePairs(createPayload);
    const columns = pairs.map(([column]) => column).join(', ');
    const placeholders = pairs.map((_, index) => `$${index + 1}`).join(', ');
    const values = pairs.map(([, value]) => value);

    const result = await query(
      `INSERT INTO bookings (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    const bookingId = result.rows[0].id;

    await Promise.all([
      replaceTentConfigs(bookingId, createPayload.tentConfigs || []),
      replaceBreakdownItems(bookingId, createPayload.breakdown || {}),
    ]);

    return this.findById(bookingId);
  }

  async findById(id) {
    const result = await query('SELECT * FROM bookings WHERE id = $1 LIMIT 1', [id]);
    return (await hydrateBookings(result.rows))[0] || null;
  }

  async findByCheckoutRequestId(checkoutRequestId) {
    const result = await query('SELECT * FROM bookings WHERE checkout_request_id = $1 LIMIT 1', [checkoutRequestId]);
    return (await hydrateBookings(result.rows))[0] || null;
  }

  async findByPesapalOrderTrackingId(orderTrackingId) {
    const result = await query('SELECT * FROM bookings WHERE pesapal_order_tracking_id = $1 LIMIT 1', [orderTrackingId]);
    return (await hydrateBookings(result.rows))[0] || null;
  }

  async findByMpesaPhone(mpesaPhone) {
    const result = await query('SELECT * FROM bookings WHERE mpesa_phone = $1 LIMIT 1', [mpesaPhone]);
    return (await hydrateBookings(result.rows))[0] || null;
  }

  async findPaginated(page, limit) {
    const skip = (page - 1) * limit;
    const [rowsResult, totalResult] = await Promise.all([
      query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, skip]),
      query('SELECT COUNT(*)::int AS count FROM bookings'),
    ]);

    return {
      bookings: await hydrateBookings(rowsResult.rows),
      total: Number(totalResult.rows[0]?.count || 0),
    };
  }

  async updateById(id, updates) {
    const shouldReplaceTentConfigs = hasOwn(updates, 'tentConfigs');
    const shouldReplaceBreakdown = hasOwn(updates, 'breakdown');
    const pairs = buildColumnValuePairs({
      ...updates,
      updatedAt: updates.updatedAt || new Date(),
    }).filter(([column]) => column !== 'id');

    if (pairs.length > 0) {
      const values = pairs.map(([, value]) => value);
      await query(
        `UPDATE bookings SET ${buildUpdateStatement(pairs)} WHERE id = $${pairs.length + 1}`,
        [...values, id]
      );
    }

    const normalizedUpdates = applyDerivedFields(updates);

    if (shouldReplaceTentConfigs) {
      await replaceTentConfigs(id, normalizedUpdates.tentConfigs || []);
    }

    if (shouldReplaceBreakdown) {
      await replaceBreakdownItems(id, normalizedUpdates.breakdown || {});
    }

    return this.findById(id);
  }

  async updateByFields(filters, updates) {
    const filterPairs = Object.entries(filters).reduce((accumulator, [key, value]) => {
      const column = fieldMap[key];
      if (column) {
        accumulator.push([column, value]);
      }
      return accumulator;
    }, []);

    if (filterPairs.length === 0) {
      throw new Error('At least one supported filter is required');
    }

    const updatePairs = buildColumnValuePairs({
      ...updates,
      updatedAt: updates.updatedAt || new Date(),
    }).filter(([column]) => column !== 'id');

    if (updatePairs.length === 0) {
      const whereClause = filterPairs.map(([column], index) => `${column} = $${index + 1}`).join(' AND ');
      const result = await query(`SELECT * FROM bookings WHERE ${whereClause} LIMIT 1`, filterPairs.map(([, value]) => value));
      return (await hydrateBookings(result.rows))[0] || null;
    }

    const setValues = updatePairs.map(([, value]) => value);
    const filterValues = filterPairs.map(([, value]) => value);
    const whereClause = filterPairs
      .map(([column], index) => `${column} = $${updatePairs.length + index + 1}`)
      .join(' AND ');

    const result = await query(
      `UPDATE bookings SET ${buildUpdateStatement(updatePairs)} WHERE ${whereClause} RETURNING *`,
      [...setValues, ...filterValues]
    );

    return (await hydrateBookings(result.rows))[0] || null;
  }

  async markPaid(id, { paymentMethod, transactionId, paidAmount }) {
    const existingBooking = await this.findById(id);

    if (!existingBooking) {
      return null;
    }

    const normalizedPaidAmount = Number.isFinite(Number(paidAmount)) && Number(paidAmount) > 0
      ? Math.round(Number(paidAmount))
      : Math.round(Number(existingBooking.depositAmount || existingBooking.totalAmount || 0));

    const totalAmount = Math.round(Number(existingBooking.totalAmount || 0));
    const remainingAmount = Math.max(totalAmount - normalizedPaidAmount, 0);

    return this.updateById(id, {
      status: 'paid',
      paymentMethod,
      transactionId,
      depositAmount: normalizedPaidAmount,
      remainingAmount,
      paymentFailureReason: null,
      paymentFailureCode: null,
      lastPaymentError: null,
    });
  }

  async markPaymentFailed(id, { reason, code, error, attemptedAt = new Date() }) {
    return this.updateById(id, {
      status: 'payment_failed',
      paymentFailureReason: reason,
      paymentFailureCode: code,
      lastPaymentAttempt: attemptedAt,
      lastPaymentError: error,
    });
  }

  async markInvoiceSent(id, invoiceSentAt = new Date()) {
    return this.updateById(id, {
      invoiceSent: true,
      invoiceSentAt,
    });
  }

  async claimInvoiceDispatch(id, invoiceSentAt = new Date()) {
    const result = await query(
      `UPDATE bookings
       SET invoice_sent = TRUE,
           invoice_sent_at = $1,
           updated_at = $2
       WHERE id = $3
         AND status = $4
         AND invoice_sent IS NOT TRUE
       RETURNING *`,
      [invoiceSentAt, invoiceSentAt, id, 'paid']
    );

    return (await hydrateBookings(result.rows))[0] || null;
  }

  async releaseInvoiceDispatch(id) {
    return this.updateById(id, {
      invoiceSent: false,
      invoiceSentAt: null,
    });
  }

  async findPaidWithoutInvoice() {
    const result = await query(
      'SELECT * FROM bookings WHERE status = $1 AND invoice_sent IS NOT TRUE ORDER BY updated_at DESC',
      ['paid']
    );

    return hydrateBookings(result.rows);
  }
}

module.exports = new BookingRepository();