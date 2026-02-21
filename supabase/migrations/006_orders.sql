-- ─── Orders (internal, stores computed amounts for auditability) ───────────────

create table orders (
  id                   uuid          primary key default gen_random_uuid(),
  type                 order_type    not null,
  user_id              uuid          not null references profiles(id),
  gym_id               uuid          references gyms(id),          -- null for SUBSCRIPTION orders
  platform_fee_bps     integer       not null,
  gst_rate_bps         integer       not null,
  gym_price_paise      integer       not null,
  platform_fee_paise   integer       not null,
  gst_paise            integer       not null,
  total_paise          integer       not null,
  status               order_status  not null default 'CREATED',
  created_at           timestamptz   not null default now()
);

create index orders_user_idx on orders(user_id);
create index orders_gym_idx on orders(gym_id) where gym_id is not null;
create index orders_status_idx on orders(status);

-- ─── Payments (gateway mapping) ───────────────────────────────────────────────

create table payments (
  id                   uuid             primary key default gen_random_uuid(),
  order_id             uuid             not null references orders(id) on delete cascade,
  provider             payment_provider not null,
  provider_order_id    text             not null,   -- Razorpay order_id
  provider_payment_id  text,                        -- Razorpay payment_id (set after capture)
  status               payment_status   not null default 'CREATED',
  raw_webhook          jsonb,                       -- raw webhook payload for disputes
  created_at           timestamptz      not null default now()
);

-- Prevent duplicate processing of the same gateway payment
create unique index payments_provider_payment_unique
  on payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create index payments_order_idx on payments(order_id);
