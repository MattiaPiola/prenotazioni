-- Add sort_order and active columns to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Initialize sort_order based on current alphabetical name ordering
WITH ordered AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY name) - 1) AS new_order
  FROM rooms
)
UPDATE rooms SET sort_order = ordered.new_order
FROM ordered WHERE rooms.id = ordered.id;
