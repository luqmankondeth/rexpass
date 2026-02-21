-- ─── Audit logs ───────────────────────────────────────────────────────────────

create table audit_logs (
  id              uuid        primary key default gen_random_uuid(),
  actor_user_id   uuid        references profiles(id),   -- null for cron/system actions
  action          text        not null,                  -- e.g. 'REFUND_ISSUED', 'GYM_CREATED'
  entity_type     text        not null,                  -- e.g. 'order', 'gym', 'checkin'
  entity_id       uuid,
  metadata        jsonb,
  -- For webhook replay prevention: store provider event IDs
  idempotency_key text,
  created_at      timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs(actor_user_id);
create index audit_logs_action_idx on audit_logs(action);

-- Idempotency key must be unique when present (prevents webhook replay)
create unique index audit_logs_idempotency_unique
  on audit_logs(idempotency_key)
  where idempotency_key is not null;
