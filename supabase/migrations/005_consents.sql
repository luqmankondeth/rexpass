-- ─── DPDP Consent (opt-in, auditable) ─────────────────────────────────────────

create table consents (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references profiles(id) on delete cascade,
  type          consent_type  not null,
  scope_gym_id  uuid          references gyms(id) on delete cascade,  -- null = any gym
  status        consent_status not null,
  granted_at    timestamptz,
  withdrawn_at  timestamptz,
  created_at    timestamptz   not null default now()
);

create index consents_user_type_idx on consents(user_id, type, status);

-- ─── Consent audit trail (append-only) ────────────────────────────────────────

create table consent_events (
  id             uuid        primary key default gen_random_uuid(),
  consent_id     uuid        not null references consents(id) on delete cascade,
  event          text        not null,   -- 'GRANTED' | 'WITHDRAWN' | 'UPDATED'
  actor_user_id  uuid        references profiles(id),
  ip_hash        text,
  user_agent_hash text,
  source_screen  text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index consent_events_consent_idx on consent_events(consent_id);
