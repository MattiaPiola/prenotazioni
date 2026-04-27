-- =============================================================================
-- Migration 010: Full schema reset from scratch
-- Drops all application tables and recreates them at the latest schema version.
-- Run this on a clean/empty database to bootstrap the full schema in one step.
-- WARNING: this DESTROYS ALL DATA – use only for fresh installs or resets.
-- =============================================================================

-- Drop tables in reverse dependency order to avoid FK violations
DROP TABLE IF EXISTS admin_room_permissions CASCADE;
DROP TABLE IF EXISTS admin_users          CASCADE;
DROP TABLE IF EXISTS notification_rules   CASCADE;
DROP TABLE IF EXISTS blocked_slots        CASCADE;
DROP TABLE IF EXISTS bookings             CASCADE;
DROP TABLE IF EXISTS recurring_requests   CASCADE;
DROP TABLE IF EXISTS room_slots           CASCADE;
DROP TABLE IF EXISTS rooms                CASCADE;

-- =============================================================================
-- rooms
-- =============================================================================
CREATE TABLE rooms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  announcement        TEXT,
  allow_user_edit     BOOLEAN     NOT NULL DEFAULT FALSE,
  visible_weekdays    INT[]       NOT NULL DEFAULT '{0,1,2,3,4}',
  emoji               TEXT,
  sort_order          INT         NOT NULL DEFAULT 0,
  active              BOOLEAN     NOT NULL DEFAULT TRUE,
  booking_weeks_ahead INTEGER     NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- room_slots
-- =============================================================================
CREATE TABLE room_slots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_time   TEXT        NOT NULL,
  end_time     TEXT        NOT NULL,
  label        TEXT,
  sort_order   INT         NOT NULL DEFAULT 0,
  max_bookings INT         NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- bookings
-- (The UNIQUE constraint on (room_id, date, room_slot_id) was intentionally
--  dropped in migration 002 to support max_bookings > 1.)
-- =============================================================================
CREATE TABLE bookings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              UUID        NOT NULL REFERENCES rooms(id)      ON DELETE CASCADE,
  room_slot_id         UUID        NOT NULL REFERENCES room_slots(id) ON DELETE CASCADE,
  date                 DATE        NOT NULL,
  teacher_name         TEXT        NOT NULL,
  class_name           TEXT        NOT NULL,
  source               TEXT        NOT NULL DEFAULT 'single'
                                   CHECK (source IN ('single', 'recurring')),
  recurring_request_id UUID,
  status               TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'cancelled')),
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bookings_status_idx ON bookings (status);

-- =============================================================================
-- recurring_requests
-- =============================================================================
CREATE TABLE recurring_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id)      ON DELETE CASCADE,
  room_slot_id UUID        NOT NULL REFERENCES room_slots(id) ON DELETE CASCADE,
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  weekdays     INT[]       NOT NULL,
  teacher_name TEXT        NOT NULL,
  class_name   TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at   TIMESTAMPTZ,
  admin_notes  TEXT
);

-- =============================================================================
-- blocked_slots
-- =============================================================================
CREATE TABLE blocked_slots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id)      ON DELETE CASCADE,
  room_slot_id UUID        NOT NULL REFERENCES room_slots(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  reason       TEXT,
  type         TEXT        NOT NULL DEFAULT 'disabled'
                           CHECK (type IN ('disabled', 'locked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, room_slot_id, date)
);

-- =============================================================================
-- notification_rules  (Telegram alert subscriptions)
-- =============================================================================
CREATE TABLE notification_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  event_type       TEXT        NOT NULL
                               CHECK (event_type IN (
                                 'booking_created',
                                 'recurring_request_created',
                                 'recurring_request_approved',
                                 'recurring_request_denied',
                                 'booking_cancelled'
                               )),
  scope            TEXT        NOT NULL
                               CHECK (scope IN ('all_rooms', 'specific_rooms')),
  room_ids         UUID[],
  telegram_chat_id TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_rules_event_type_idx ON notification_rules (event_type);
CREATE INDEX notification_rules_enabled_idx    ON notification_rules (enabled);

-- =============================================================================
-- admin_users  (room-admins created by the superadmin)
-- =============================================================================
CREATE TABLE admin_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  code_hash  TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- admin_room_permissions
-- =============================================================================
CREATE TABLE admin_room_permissions (
  admin_user_id UUID        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  room_id       UUID        NOT NULL REFERENCES rooms(id)       ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_user_id, room_id)
);

CREATE INDEX idx_admin_room_permissions_user ON admin_room_permissions (admin_user_id);
CREATE INDEX idx_admin_room_permissions_room ON admin_room_permissions (room_id);
