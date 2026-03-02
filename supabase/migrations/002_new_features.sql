-- Add new columns to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS announcement TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_user_edit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS visible_weekdays INT[] NOT NULL DEFAULT '{0,1,2,3,4}';

-- Add max_bookings to room_slots
ALTER TABLE room_slots ADD COLUMN IF NOT EXISTS max_bookings INT NOT NULL DEFAULT 1;

-- Blocked slots table
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_slot_id UUID NOT NULL REFERENCES room_slots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, room_slot_id, date)
);

-- Drop the single-booking-per-slot unique constraint to allow max_bookings > 1
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_room_id_date_room_slot_id_key;
