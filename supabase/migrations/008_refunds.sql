-- ─── Refunds ──────────────────────────────────────────────────────────────────

create type refund_status as enum ('PENDING', 'SUCCEEDED', 'FAILED');

create table refunds (
  id                     uuid          primary key default gen_random_uuid(),
  order_id               uuid          not null references orders(id),
  payment_id             uuid          not null references payments(id),
  amount_paise           integer       not null,
  status                 refund_status not null default 'PENDING',
  provider_refund_id     text,                         -- Razorpay refund ID
  initiated_by_user_id   uuid          references profiles(id),  -- platform admin
  reason                 text,
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now()
);

create index refunds_order_idx on refunds(order_id);
create index refunds_status_idx on refunds(status);

create trigger refunds_updated_at
  before update on refunds
  for each row execute procedure set_updated_at();
