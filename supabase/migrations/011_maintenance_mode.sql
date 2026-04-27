-- Migration 011: app_settings table for maintenance mode (and future settings)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
