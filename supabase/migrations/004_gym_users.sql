-- ─── Gym ↔ User membership (staff and gym admins) ─────────────────────────────

create type gym_role as enum ('gym_staff', 'gym_admin');

create table gym_users (
  user_id   uuid      not null references profiles(id) on delete cascade,
  gym_id    uuid      not null references gyms(id) on delete cascade,
  gym_role  gym_role  not null default 'gym_staff',
  created_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);

create index gym_users_gym_idx on gym_users(gym_id);
