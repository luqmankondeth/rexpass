-- ─── Required PostgreSQL extensions ──────────────────────────────────────────
-- Run this FIRST before any other migration.
-- Supabase allows enabling these via the SQL editor or the Extensions UI.

-- cube is a dependency of earthdistance
create extension if not exists cube;

-- earthdistance provides ll_to_earth() and earth_distance() used in get_gyms_near()
create extension if not exists earthdistance;
