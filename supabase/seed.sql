-- ─── Seed data for development / testing ──────────────────────────────────────
-- Run AFTER migrations.
-- Uses fixed UUIDs so data is stable across resets.

-- ─── Gyms ─────────────────────────────────────────────────────────────────────

insert into gyms (id, public_code, name, address, city, lat, lng, base_price_paise, rules_text)
values
  (
    '11111111-0000-0000-0000-000000000001',
    'KOC-CRX-001',
    'Crux Life',
    '12/A MG Road, Ernakulam',
    'Kochi',
    9.9312, 76.2673,
    35000,
    'One entry = one day access. Please carry a towel. Lockers available.'
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'KOC-BGT-001',
    'Budget Fit',
    '34 Palarivattom Junction',
    'Kochi',
    9.9842, 76.3096,
    15000,
    'Basic equipment. Open 5 AM – 10 PM. No guest entry.'
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'TVM-PRE-001',
    'Premium Zone',
    '88 Statue Junction, Thiruvananthapuram',
    'Thiruvananthapuram',
    8.4855, 76.9492,
    60000,
    'Full equipment. Steam room included. Towel provided. Dress code enforced.'
  );

-- ─── Gym caps ─────────────────────────────────────────────────────────────────

insert into gym_caps (gym_id, daily_cap, cap_timezone)
values
  ('11111111-0000-0000-0000-000000000001', 30, 'Asia/Kolkata'),
  ('11111111-0000-0000-0000-000000000002', 50, 'Asia/Kolkata'),
  ('11111111-0000-0000-0000-000000000003', 20, 'Asia/Kolkata');

-- ─── Peak pricing windows ─────────────────────────────────────────────────────

-- Crux Life: morning peak Mon-Fri 6–9 AM
insert into gym_price_windows (gym_id, label, days_of_week, start_time, end_time, price_paise)
values (
  '11111111-0000-0000-0000-000000000001',
  'Morning Peak',
  '{1,2,3,4,5}',   -- Mon–Fri
  '06:00', '09:00',
  45000             -- ₹450 during peak
);

-- Premium Zone: evening peak all days 6–9 PM
insert into gym_price_windows (gym_id, label, days_of_week, start_time, end_time, price_paise)
values (
  '11111111-0000-0000-0000-000000000003',
  'Evening Peak',
  '{0,1,2,3,4,5,6}',
  '18:00', '21:00',
  75000             -- ₹750 during peak
);

-- ─── Note on users ────────────────────────────────────────────────────────────
-- Auth users must be created via Supabase Auth (not SQL insert).
-- After creating test users in the Supabase dashboard or via the API,
-- update their profile roles like this:
--
-- update profiles set role = 'platform_admin' where id = '<admin-user-uuid>';
-- update profiles set role = 'gym_admin' where id = '<gymadmin-user-uuid>';
-- update profiles set role = 'gym_staff' where id = '<staff-user-uuid>';
--
-- Then link gym staff/admin:
-- insert into gym_users (user_id, gym_id, gym_role)
-- values ('<gymadmin-user-uuid>', '11111111-0000-0000-0000-000000000001', 'gym_admin');
