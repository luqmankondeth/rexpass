-- ─── Fix: infinite recursion in gym_users RLS policies ────────────────────────
-- The gym_users policy was querying gym_users from within itself.
-- Fix: use SECURITY DEFINER helper functions that bypass RLS when called,
-- breaking the recursive loop.

-- ── Step 1: Drop the problematic policies ─────────────────────────────────────

drop policy if exists "gym_users: gym admin read" on gym_users;
drop policy if exists "gyms: gym admin read own" on gyms;
drop policy if exists "checkins: gym staff reads gym checkins" on checkins;
drop policy if exists "profiles: gym staff can view checkin users" on profiles;

-- ── Step 2: Create SECURITY DEFINER helper functions ──────────────────────────
-- These query gym_users with RLS bypassed (security definer = runs as owner),
-- so they don't re-enter the gym_users policy.

create or replace function is_gym_member(p_gym_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from gym_users
    where user_id = auth.uid()
      and gym_id = p_gym_id
  );
$$;

create or replace function is_gym_admin_of(p_gym_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from gym_users
    where user_id = auth.uid()
      and gym_id = p_gym_id
      and gym_role = 'gym_admin'
  );
$$;

-- ── Step 3: Recreate policies using the helper functions ──────────────────────

-- gym_users: gym admins can read the staff list for their gym
create policy "gym_users: gym admin read"
  on gym_users for select
  using (is_gym_admin_of(gym_id));

-- gyms: gym admins can read their own gym even if paused
create policy "gyms: gym admin read own"
  on gyms for select
  using (is_gym_admin_of(id));

-- checkins: gym staff/admin can see check-ins at their gym
create policy "checkins: gym staff reads gym checkins"
  on checkins for select
  using (is_gym_member(gym_id));

-- profiles: gym staff can view profiles of users who checked in at their gym
create policy "profiles: gym staff can view checkin users"
  on profiles for select
  using (
    exists (
      select 1 from checkins c
      where c.user_id = profiles.id
        and is_gym_member(c.gym_id)
    )
  );
