-- Add emoji column to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS emoji TEXT;
