-- ─── Settlement batches ───────────────────────────────────────────────────────

create type settlement_status as enum ('GENERATING', 'GENERATED', 'FAILED');

create table settlement_batches (
  id             uuid               primary key default gen_random_uuid(),
  as_of          timestamptz        not null,
  holdback_days  integer            not null default 3,
  status         settlement_status  not null default 'GENERATING',
  total_gyms     integer            not null default 0,
  total_items    integer            not null default 0,
  created_by     uuid               references profiles(id),  -- null if from cron
  created_at     timestamptz        not null default now()
);

-- Prevent duplicate batch for the same as_of timestamp
create unique index settlement_batches_as_of_unique on settlement_batches(as_of)
  where status != 'FAILED';

-- ─── Settlement items (one row per eligible check-in) ─────────────────────────

create table settlement_items (
  id                  uuid        primary key default gen_random_uuid(),
  batch_id            uuid        not null references settlement_batches(id) on delete cascade,
  checkin_id          uuid        not null references checkins(id),
  gym_id              uuid        not null references gyms(id),
  gym_payout_paise    integer     not null,
  currency            text        not null default 'INR',
  created_at          timestamptz not null default now()
);

-- Each check-in can only appear in one settlement batch
create unique index settlement_items_checkin_unique on settlement_items(checkin_id);

create index settlement_items_batch_idx on settlement_items(batch_id);
create index settlement_items_gym_idx on settlement_items(gym_id);
