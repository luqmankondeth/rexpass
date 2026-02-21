-- ─── Enums ───────────────────────────────────────────────────────────────────

create type user_role as enum (
  'user',
  'gym_staff',
  'gym_admin',
  'platform_admin'
);

create type order_type as enum (
  'ENTRY',
  'SUBSCRIPTION'
);

create type order_status as enum (
  'CREATED',
  'PAID',
  'CANCELLED',
  'REFUNDED'
);

create type payment_provider as enum (
  'RAZORPAY',
  'CASHFREE'
);

create type payment_status as enum (
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED'
);

create type checkin_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

create type consent_type as enum (
  'LEAD_SHARING',
  'MARKETING'
);

create type consent_status as enum (
  'GRANTED',
  'WITHDRAWN'
);
