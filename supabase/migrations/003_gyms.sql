-- ─── Gyms ─────────────────────────────────────────────────────────────────────

create table gyms (
  id                uuid        primary key default gen_random_uuid(),
  public_code       text        not null,           -- short printable code, e.g. KOC-CRX-001
  name              text        not null,
  address           text,
  city              text,
  state             text        not null default 'Kerala',
  lat               double precision not null,
  lng               double precision not null,
  base_price_paise  integer     not null check (base_price_paise >= 0),
  currency          text        not null default 'INR',
  rules_text        text,
  gym_logo_path     text,                           -- Supabase Storage path in 'gym-logos' bucket
  is_paused         boolean     not null default false,
  created_at        timestamptz not null default now()
);

create unique index gyms_public_code_unique on gyms(public_code);
create index gyms_city_idx on gyms(city);
create index gyms_paused_idx on gyms(is_paused);

-- ─── Peak / off-peak price windows ────────────────────────────────────────────

create table gym_price_windows (
  id              uuid      primary key default gen_random_uuid(),
  gym_id          uuid      not null references gyms(id) on delete cascade,
  label           text,                             -- e.g. "Morning Peak"
  days_of_week    smallint[] not null,              -- 0=Sun … 6=Sat
  start_time      time      not null,               -- local gym time
  end_time        time      not null,               -- local gym time
  price_paise     integer   not null check (price_paise >= 0),
  created_at      timestamptz not null default now()
);

create index gym_price_windows_gym_idx on gym_price_windows(gym_id);

-- ─── Capacity caps ────────────────────────────────────────────────────────────

create table gym_caps (
  gym_id        uuid  primary key references gyms(id) on delete cascade,
  daily_cap     integer,                           -- null = unlimited
  cap_timezone  text  not null default 'Asia/Kolkata'
);
