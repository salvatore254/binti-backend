require('dotenv').config({ override: true });

const { Client } = require('pg');

const bookingId = process.argv[2];

if (!bookingId) {
  console.error('booking-id-required');
  process.exit(1);
}

const client = new Client({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'binti_events',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const run = async () => {
  await client.connect();

  const booking = await client.query(
    `SELECT id, fullname, email, venue, setup_time, event_date, total_amount, deposit_amount, remaining_amount, status, payment_method, terms_accepted
     FROM bookings
     WHERE id = $1`,
    [bookingId]
  );

  const tents = await client.query(
    `SELECT booking_id, tent_type, tent_size, quantity, config_value, color, sort_order
     FROM booking_tent_configs
     WHERE booking_id = $1
     ORDER BY sort_order`,
    [bookingId]
  );

  const breakdown = await client.query(
    `SELECT booking_id, item_key, item_type, amount, quantity, tent_type, tent_size, arrangement, zone_name, service_area, sort_order
     FROM booking_breakdown_items
     WHERE booking_id = $1
     ORDER BY sort_order`,
    [bookingId]
  );

  console.log(JSON.stringify({
    booking: booking.rows,
    tents: tents.rows,
    breakdown: breakdown.rows,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });