-- ─── Check-ins ────────────────────────────────────────────────────────────────

create table checkins (
  id           uuid            primary key default gen_random_uuid(),
  user_id      uuid            not null references profiles(id),
  gym_id       uuid            not null references gyms(id),
  order_id     uuid            not null references orders(id),
  status       checkin_status  not null default 'PENDING',
  expires_at   timestamptz     not null,             -- now() + 90 seconds
  approved_at  timestamptz,
  rejected_at  timestamptz,
  reject_reason text,
  created_at   timestamptz     not null default now()
);

-- CRITICAL: Only one PENDING check-in allowed per user at a time
create unique index checkins_single_active_per_user
  on checkins(user_id)
  where status = 'PENDING';

create index checkins_gym_status_idx on checkins(gym_id, status, created_at desc);
create index checkins_user_idx on checkins(user_id, created_at desc);
create index checkins_settlement_idx on checkins(status, approved_at)
  where status = 'APPROVED';

-- ─── Check-in tokens (90-second one-time tokens) ──────────────────────────────

create table checkin_tokens (
  checkin_id   uuid        primary key references checkins(id) on delete cascade,
  token_hash   text        not null,    -- SHA-256 hash of the raw token
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
