-- Add type column to blocked_slots to differentiate 'disabled' (unavailable) from 'locked' (bookings protected)
ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'disabled' CHECK (type IN ('disabled', 'locked'));
