-- Add soft-delete support to bookings table
-- Cancelled bookings are retained for admin archive/audit purposes

ALTER TABLE bookings
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),
  ADD COLUMN cancelled_at TIMESTAMPTZ;

-- Index to speed up the common query filtering by status
CREATE INDEX bookings_status_idx ON bookings (status);
