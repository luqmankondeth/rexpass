-- ─── Profiles ─────────────────────────────────────────────────────────────────

create table profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  display_name  text        not null,
  phone         text,
  photo_path    text,                          -- Supabase Storage path in 'avatars' bucket
  role          user_role   not null default 'user',
  fraud_flags   jsonb       not null default '{}',  -- flag patterns, never auto-ban
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Phone must be unique when present
create unique index profiles_phone_unique on profiles(phone) where phone is not null;

create index profiles_role_idx on profiles(role);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

-- Auto-create a bare profile row on every new auth user sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
