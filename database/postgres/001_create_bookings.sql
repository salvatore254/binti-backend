CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  fullname TEXT NOT NULL,
  phone TEXT NOT NULL,
  mpesa_phone TEXT,
  email TEXT NOT NULL,
  tent_type TEXT,
  tent_size TEXT,
  sections INTEGER,
  lighting BOOLEAN NOT NULL DEFAULT FALSE,
  transport_arrangement TEXT NOT NULL DEFAULT 'own',
  transport_venue TEXT NOT NULL DEFAULT '',
  pasound BOOLEAN NOT NULL DEFAULT FALSE,
  dancefloor BOOLEAN NOT NULL DEFAULT FALSE,
  stagepodium BOOLEAN NOT NULL DEFAULT FALSE,
  welcomesigns BOOLEAN NOT NULL DEFAULT FALSE,
  site_visit BOOLEAN NOT NULL DEFAULT FALSE,
  decor BOOLEAN NOT NULL DEFAULT FALSE,
  venue TEXT NOT NULL,
  location TEXT,
  setup_time TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  package_name TEXT,
  package_base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_info TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC(12, 2) NOT NULL,
  deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  checkout_request_id TEXT,
  pesapal_order_ref TEXT,
  pesapal_order_tracking_id TEXT,
  payment_failure_reason TEXT,
  payment_failure_code INTEGER,
  last_payment_attempt TIMESTAMPTZ,
  last_payment_error TEXT,
  invoice_sent BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_sent_at TIMESTAMPTZ,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_transport_arrangement_check CHECK (transport_arrangement IN ('own', 'arrange')),
  CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'payment_failed')),
  CONSTRAINT bookings_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('mpesa', 'pesapal'))
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_checkout_request_id_key
  ON bookings (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_pesapal_order_tracking_id_key
  ON bookings (pesapal_order_tracking_id)
  WHERE pesapal_order_tracking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_invoice_sent_idx ON bookings (status, invoice_sent);
CREATE INDEX IF NOT EXISTS bookings_mpesa_phone_idx ON bookings (mpesa_phone);
CREATE INDEX IF NOT EXISTS bookings_transaction_id_idx ON bookings (transaction_id);

CREATE TABLE IF NOT EXISTS booking_tent_configs (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tent_type TEXT NOT NULL,
  tent_size TEXT,
  sections INTEGER,
  config_value TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS booking_tent_configs_booking_id_idx
  ON booking_tent_configs (booking_id, sort_order);

CREATE TABLE IF NOT EXISTS booking_breakdown_items (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_type TEXT NOT NULL,
  label TEXT,
  amount NUMERIC(12, 2),
  quantity INTEGER,
  unit_price NUMERIC(12, 2),
  tent_type TEXT,
  tent_size TEXT,
  sections INTEGER,
  config_value TEXT,
  color TEXT,
  zone_name TEXT,
  service_area TEXT,
  arrangement TEXT,
  region TEXT,
  distance TEXT,
  confidence TEXT,
  description_text TEXT,
  item_count INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS booking_breakdown_items_booking_id_idx
  ON booking_breakdown_items (booking_id, sort_order);