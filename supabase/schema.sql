-- Weekly Report Dashboard — Supabase schema
-- Run once in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Model: one row of app state per user. The app already keeps everything in a single
-- `state` object, so this stores that object as JSONB rather than shredding it into
-- tables. Each person sees only their own row; nothing is shared between users.

-- ---------------------------------------------------------------- profiles
-- One row per signed-up user, so you can see who is using the app.
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create the profile automatically on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- user_state
-- The whole dashboard for one user: projects, weekly updates, templates, settings.
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- usage stats
-- Counts only — no one can read anyone else's rows through this.
-- SECURITY DEFINER so it can aggregate across profiles while RLS still blocks
-- direct selects.
create or replace function public.usage_stats()
returns table (total_users bigint, active_7d bigint, active_30d bigint)
language sql
security definer set search_path = public
as $$
  select
    count(*)                                                        as total_users,
    count(*) filter (where last_seen_at > now() - interval '7 days')  as active_7d,
    count(*) filter (where last_seen_at > now() - interval '30 days') as active_30d
  from public.profiles;
$$;

grant execute on function public.usage_stats() to authenticated;

-- Called on each sign-in so "active users" means something.
create or replace function public.touch_last_seen()
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;

-- ============================================================ RBAC
-- Two roles. Admin does everything; Viewer changes nothing.
-- Server-side enforcement is what counts; the client also hides what a role cannot do,
-- but that is convenience, not security.

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add column if not exists role text not null default 'viewer';

-- Anything created under the old four-role model collapses into the two we keep.
update public.profiles set role = 'viewer' where role not in ('admin', 'viewer');

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'viewer'));

-- ---------------------------------------------------------------- access rules
-- Mirrors roles-config.json. Kept in the database as well so the rules hold even if a
-- browser loads a stale config file.
create table if not exists public.access_rules (
  id             int primary key default 1,
  allowed_domain text not null default 'webengage.com',
  default_role   text not null default 'viewer',
  constraint one_row check (id = 1)
);

insert into public.access_rules (id, allowed_domain, default_role)
values (1, 'webengage.com', 'viewer')
on conflict (id) do nothing;

alter table public.access_rules enable row level security;

drop policy if exists "read access rules" on public.access_rules;
create policy "read access rules" on public.access_rules for select using (true);

create table if not exists public.bootstrap_admins (email text primary key);

insert into public.bootstrap_admins (email)
values ('stuti.khare@webengage.com')
on conflict (email) do nothing;

alter table public.bootstrap_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Sign-up: reject anything outside the allowed domain, and grant admin to the
-- bootstrap list. Everyone else gets the default role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  rules  public.access_rules%rowtype;
  granted text;
begin
  select * into rules from public.access_rules where id = 1;

  if rules.allowed_domain is not null and rules.allowed_domain <> ''
     and lower(new.email) not like '%@' || lower(rules.allowed_domain) then
    raise exception 'Access is restricted to @% accounts', rules.allowed_domain;
  end if;

  if exists (select 1 from public.bootstrap_admins where lower(email) = lower(new.email)) then
    granted := 'admin';
  else
    granted := coalesce(rules.default_role, 'viewer');
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, split_part(new.email, '@', 1), granted)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Roles change only through this function, never by writing to the row.
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may change roles';
  end if;

  if new_role not in ('admin', 'viewer') then
    raise exception 'unknown role: %', new_role;
  end if;

  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'you cannot remove your own admin role';
  end if;

  update public.profiles set role = new_role where id = target;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

create or replace function public.list_users()
returns table (id uuid, email text, display_name text, role text, created_at timestamptz, last_seen_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may list users';
  end if;

  return query
    select p.id, p.email, p.display_name, p.role, p.created_at, p.last_seen_at
    from public.profiles p
    order by p.last_seen_at desc;
end;
$$;

grant execute on function public.list_users() to authenticated;
