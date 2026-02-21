-- ─── Subscriptions ────────────────────────────────────────────────────────────
-- Tracks active "Plus" membership state per user.
-- Each paid SUBSCRIPTION order creates/extends one row here.

create type subscription_status as enum ('ACTIVE', 'EXPIRED', 'CANCELLED');

create table subscriptions (
  id           uuid                primary key default gen_random_uuid(),
  user_id      uuid                not null references profiles(id) on delete cascade,
  order_id     uuid                not null references orders(id),
  status       subscription_status not null default 'ACTIVE',
  starts_at    timestamptz         not null default now(),
  expires_at   timestamptz         not null,    -- starts_at + 30 days
  created_at   timestamptz         not null default now(),
  updated_at   timestamptz         not null default now()
);

-- Only one active subscription per user
create unique index subscriptions_active_user
  on subscriptions(user_id)
  where status = 'ACTIVE';

create index subscriptions_user_idx on subscriptions(user_id, expires_at desc);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute procedure set_updated_at();
