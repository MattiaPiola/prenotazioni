-- Admin users (room-admins created by superadmin)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room permissions for admin users
CREATE TABLE IF NOT EXISTS admin_room_permissions (
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_room_permissions_user ON admin_room_permissions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_room_permissions_room ON admin_room_permissions(room_id);
