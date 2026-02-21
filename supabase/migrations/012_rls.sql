-- ─── Row Level Security Policies ──────────────────────────────────────────────
-- Enable RLS on every table that can be accessed from client-side code.
-- Server routes using the service role key bypass RLS.

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

-- Users can read their own profile
create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (but NOT the role column — enforced by app logic)
create policy "profiles: own update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Gym staff/admin can read profiles of users who have check-ins at their gym
create policy "profiles: gym staff can view checkin users"
  on profiles for select
  using (
    exists (
      select 1 from checkins c
      join gym_users gu on gu.gym_id = c.gym_id
      where c.user_id = profiles.id
        and gu.user_id = auth.uid()
    )
  );

-- ── gyms ─────────────────────────────────────────────────────────────────────
alter table gyms enable row level security;

-- Anyone can read active (non-paused) gyms
create policy "gyms: public read active"
  on gyms for select
  using (is_paused = false);

-- Gym admins can read their own gym even if paused
create policy "gyms: gym admin read own"
  on gyms for select
  using (
    exists (
      select 1 from gym_users gu
      where gu.gym_id = gyms.id
        and gu.user_id = auth.uid()
        and gu.gym_role = 'gym_admin'
    )
  );

-- No client-side writes on gyms (all writes go through server routes with service role)

-- ── gym_price_windows ─────────────────────────────────────────────────────────
alter table gym_price_windows enable row level security;

create policy "gym_price_windows: public read"
  on gym_price_windows for select
  using (
    exists (select 1 from gyms where id = gym_id and is_paused = false)
  );

-- ── gym_caps ─────────────────────────────────────────────────────────────────
alter table gym_caps enable row level security;

create policy "gym_caps: public read"
  on gym_caps for select
  using (true);

-- ── gym_users ─────────────────────────────────────────────────────────────────
alter table gym_users enable row level security;

-- Gym admin can see the staff list for their gym
create policy "gym_users: gym admin read"
  on gym_users for select
  using (
    gym_id in (
      select gym_id from gym_users
      where user_id = auth.uid() and gym_role = 'gym_admin'
    )
  );

-- ── orders ────────────────────────────────────────────────────────────────────
alter table orders enable row level security;

create policy "orders: user reads own"
  on orders for select
  using (auth.uid() = user_id);

-- ── payments ─────────────────────────────────────────────────────────────────
alter table payments enable row level security;

create policy "payments: user reads own via order"
  on payments for select
  using (
    exists (select 1 from orders where id = order_id and user_id = auth.uid())
  );

-- ── checkins ─────────────────────────────────────────────────────────────────
alter table checkins enable row level security;

-- Users can see their own check-ins
create policy "checkins: user reads own"
  on checkins for select
  using (auth.uid() = user_id);

-- Gym staff can see check-ins at their gym
create policy "checkins: gym staff reads gym checkins"
  on checkins for select
  using (
    exists (
      select 1 from gym_users gu
      where gu.gym_id = checkins.gym_id
        and gu.user_id = auth.uid()
    )
  );

-- ── consents ─────────────────────────────────────────────────────────────────
alter table consents enable row level security;

-- Users can read and modify their own consents
create policy "consents: user reads own"
  on consents for select
  using (auth.uid() = user_id);

create policy "consents: user inserts own"
  on consents for insert
  with check (auth.uid() = user_id);

create policy "consents: user updates own"
  on consents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── consent_events ────────────────────────────────────────────────────────────
alter table consent_events enable row level security;

-- Users can read their own consent events
create policy "consent_events: user reads own"
  on consent_events for select
  using (
    exists (select 1 from consents c where c.id = consent_id and c.user_id = auth.uid())
  );

-- ── subscriptions ─────────────────────────────────────────────────────────────
alter table subscriptions enable row level security;

create policy "subscriptions: user reads own"
  on subscriptions for select
  using (auth.uid() = user_id);

-- ── audit_logs ────────────────────────────────────────────────────────────────
alter table audit_logs enable row level security;
-- No client reads — only readable via service role (admin portal)

-- ── refunds ──────────────────────────────────────────────────────────────────
alter table refunds enable row level security;

create policy "refunds: user reads own via order"
  on refunds for select
  using (
    exists (select 1 from orders where id = order_id and user_id = auth.uid())
  );

-- ── settlement_batches / settlement_items ─────────────────────────────────────
alter table settlement_batches enable row level security;
alter table settlement_items enable row level security;
-- No client reads — only readable via service role (admin portal and gym statements)
