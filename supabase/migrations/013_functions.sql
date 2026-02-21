-- ─── DB Functions ─────────────────────────────────────────────────────────────

-- Geo distance search using the built-in earthdistance extension.
-- Supabase enables earthdistance by default on all projects.
--
-- Returns gyms within radius_km of (lat, lng), ordered by distance ascending.
-- Only returns active (non-paused) gyms.

create or replace function get_gyms_near(
  user_lat   double precision,
  user_lng   double precision,
  radius_km  double precision default 10,
  max_results integer default 50
)
returns table (
  id                uuid,
  public_code       text,
  name              text,
  address           text,
  city              text,
  state             text,
  lat               double precision,
  lng               double precision,
  base_price_paise  integer,
  currency          text,
  rules_text        text,
  gym_logo_path     text,
  is_paused         boolean,
  created_at        timestamptz,
  distance_km       double precision
)
language sql stable as $$
  select
    g.id,
    g.public_code,
    g.name,
    g.address,
    g.city,
    g.state,
    g.lat,
    g.lng,
    g.base_price_paise,
    g.currency,
    g.rules_text,
    g.gym_logo_path,
    g.is_paused,
    g.created_at,
    (
      earth_distance(
        ll_to_earth(user_lat, user_lng),
        ll_to_earth(g.lat, g.lng)
      ) / 1000.0
    ) as distance_km
  from gyms g
  where
    g.is_paused = false
    and earth_distance(
          ll_to_earth(user_lat, user_lng),
          ll_to_earth(g.lat, g.lng)
        ) <= (radius_km * 1000)
  order by distance_km asc
  limit max_results;
$$;

-- Check how many check-ins a gym has had today (for cap enforcement)
create or replace function count_gym_checkins_today(p_gym_id uuid)
returns integer
language sql stable as $$
  select count(*)::integer
  from checkins c
  join gym_caps gc on gc.gym_id = c.gym_id
  where c.gym_id = p_gym_id
    and c.status in ('PENDING', 'APPROVED')
    and c.created_at >= (now() at time zone gc.cap_timezone)::date::timestamptz
$$;
