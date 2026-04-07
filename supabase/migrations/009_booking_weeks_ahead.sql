-- Add booking_weeks_ahead to rooms
-- Controls how many weeks ahead (beyond the current week) users can make reservations.
-- Default 1 = current week + 1 future week (the previous behaviour).
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS booking_weeks_ahead integer NOT NULL DEFAULT 1;
