-- Migration 005: Notification rules for Telegram alerts

create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  event_type text not null,
  scope text not null,
  room_ids uuid[] null,
  telegram_chat_id text not null,
  created_at timestamptz not null default now(),

  constraint notification_rules_scope_check check (scope in ('all_rooms', 'specific_rooms')),
  constraint notification_rules_event_type_check check (
    event_type in (
      'booking_created',
      'recurring_request_created',
      'recurring_request_approved',
      'recurring_request_denied',
      'booking_cancelled'
    )
  )
);

create index notification_rules_event_type_idx on notification_rules (event_type);
create index notification_rules_enabled_idx on notification_rules (enabled);
