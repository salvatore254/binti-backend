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

ALTER TABLE bookings DROP COLUMN IF EXISTS tent_configs;
ALTER TABLE bookings DROP COLUMN IF EXISTS breakdown;