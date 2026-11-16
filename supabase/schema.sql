-- Weekly Report Dashboard — Supabase schema (shared projects, three roles)
-- Run in Supabase: SQL Editor → New query → paste all of this → Run. Safe to re-run.
--
-- Model
--   profiles           one row per person who has signed in (Google), with their role
--   wr_projects        one row per project: its details and all its weekly reports, as JSONB
--   wr_project_shares  who else may see / edit a project, by email (works before they sign in)
--   wr_activity_log    sign-ins and project changes, for the admin's usage view
--
-- The wr_ prefix is deliberate: this Supabase project already had an unrelated `projects`
-- table (uuid ids), and these names keep the two apart. Older tables are left untouched.
--
-- Roles
--   user     (default) sees and edits own projects + projects shared with them
--   manager  sees ALL projects (overview); edits only own / shared-with-edit
--   admin    sees and edits everything, changes roles, sees usage
--
-- Every rule below is enforced by the database (row-level security). The app hides what a
-- person cannot do, but that is convenience; this file is the control.

-- ============================================================ profiles
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'user',
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- The project may already hold a `profiles` table from an earlier setup (this one had
-- id/email/role/full_name). Bring it to this shape without dropping rows or columns.
alter table public.profiles add column if not exists email        text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role         text;
alter table public.profiles add column if not exists created_at   timestamptz not null default now();
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();

do $$
declare rec record;
begin
  -- Any other NOT NULL column without a default (full_name, say) would fail every sign-up.
  for rec in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and is_nullable = 'NO' and column_default is null
      and column_name not in ('id', 'email', 'role')
  loop
    execute format('alter table public.profiles alter column %I drop not null', rec.column_name);
  end loop;

  -- Any older check on role (other names, other values) is replaced by ours.
  for rec in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', rec.conname);
  end loop;
end $$;

update public.profiles set role = 'user' where role is null or role not in ('admin', 'manager', 'user');
alter table public.profiles alter column role set default 'user';
alter table public.profiles alter column role set not null;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'manager', 'user'));

alter table public.profiles enable row level security;

-- ============================================================ access settings
create table if not exists public.access_rules (
  id             int primary key default 1,
  allowed_domain text not null default 'webengage.com',
  constraint one_row check (id = 1)
);
-- An older access_rules may lack the column; add it rather than fail.
alter table public.access_rules add column if not exists allowed_domain text not null default 'webengage.com';
insert into public.access_rules (id, allowed_domain) values (1, 'webengage.com')
on conflict (id) do nothing;
alter table public.access_rules enable row level security;

-- Whoever is listed here becomes admin on first sign-in.
create table if not exists public.bootstrap_admins (email text primary key);
insert into public.bootstrap_admins (email) values ('stuti.khare@webengage.com')
on conflict (email) do nothing;
alter table public.bootstrap_admins enable row level security;

-- ============================================================ projects
create table if not exists public.wr_projects (
  id           text primary key,                       -- the app's own project id
  owner_id     uuid not null references auth.users on delete restrict,
  owner_email  text not null,
  project      jsonb not null default '{}'::jsonb,     -- name, dates, team, scope, status ...
  updates      jsonb not null default '[]'::jsonb,     -- the project's weekly reports
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);
alter table public.wr_projects enable row level security;

create table if not exists public.wr_project_shares (
  project_id  text not null references public.wr_projects on delete cascade,
  email       text not null,
  access      text not null default 'read' check (access in ('read', 'edit')),
  created_at  timestamptz not null default now(),
  created_by  text,
  primary key (project_id, email)
);
alter table public.wr_project_shares enable row level security;

create table if not exists public.wr_activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  email       text,
  action      text not null,                            -- signin | create | edit | delete | share
  project_id  text,
  at          timestamptz not null default now()
);
create index if not exists wr_activity_log_at on public.wr_activity_log (at desc);
alter table public.wr_activity_log enable row level security;

-- ============================================================ helpers
-- SECURITY DEFINER so policies can ask these questions without recursing into each other.
create or replace function public.my_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin';
$$;

create or replace function public.share_access(pid text)
returns text language sql stable security definer set search_path = public as $$
  select access from public.wr_project_shares where project_id = pid and email = public.my_email();
$$;

create or replace function public.can_read_project(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'manager')
      or exists (select 1 from public.wr_projects where id = pid and owner_id = auth.uid())
      or public.share_access(pid) is not null;
$$;

create or replace function public.can_edit_project(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.wr_projects where id = pid and owner_id = auth.uid())
      or public.share_access(pid) = 'edit';
$$;

create or replace function public.owns_project(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.wr_projects where id = pid and owner_id = auth.uid());
$$;

-- ============================================================ policies
-- profiles: everyone signed in may read names/emails/roles (needed to show owners and to
-- share by email); nobody writes a profile directly — roles change via set_user_role().
drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "profiles readable"  on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using (true);

drop policy if exists "read access rules" on public.access_rules;
create policy "read access rules" on public.access_rules for select to authenticated using (true);

drop policy if exists "projects select" on public.wr_projects;
drop policy if exists "projects insert" on public.wr_projects;
drop policy if exists "projects update" on public.wr_projects;
drop policy if exists "projects delete" on public.wr_projects;
create policy "projects select" on public.wr_projects for select to authenticated
  using (public.can_read_project(id));
create policy "projects insert" on public.wr_projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "projects update" on public.wr_projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy "projects delete" on public.wr_projects for delete to authenticated
  using (public.owns_project(id));

-- Shares: the owner (or admin) manages them; a person can see the shares naming them.
drop policy if exists "shares select" on public.wr_project_shares;
drop policy if exists "shares write"  on public.wr_project_shares;
create policy "shares select" on public.wr_project_shares for select to authenticated
  using (public.owns_project(project_id) or email = public.my_email()
         or public.my_role() = 'manager');
create policy "shares write" on public.wr_project_shares for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

-- Activity is written only by triggers / functions below and read only by admin.
drop policy if exists "activity admin" on public.wr_activity_log;
create policy "activity admin" on public.wr_activity_log for select to authenticated
  using (public.is_admin());

-- ============================================================ table privileges
revoke all on public.profiles, public.wr_projects, public.wr_project_shares, public.wr_activity_log,
              public.access_rules, public.bootstrap_admins from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles, public.access_rules to authenticated;
grant select, insert, update, delete on public.wr_projects, public.wr_project_shares to authenticated;
grant select on public.wr_activity_log to authenticated;

-- ============================================================ triggers
-- New sign-up: enforce the company domain, create the profile, grant bootstrap admins.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  domain  text;
  granted text := 'user';
begin
  select allowed_domain into domain from public.access_rules where id = 1;
  if coalesce(domain, '') <> '' and lower(new.email) not like '%@' || lower(domain) then
    raise exception 'Access is restricted to @% accounts', domain;
  end if;

  if exists (select 1 from public.bootstrap_admins where lower(email) = lower(new.email)) then
    granted := 'admin';
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (new.id, lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          granted)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects: stamp who/when, keep the owner fixed (only admin may reassign), and log.
create or replace function public.wr_projects_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := public.my_email();
  if tg_op = 'INSERT' then
    new.owner_email := public.my_email();
    new.created_at  := now();
  elsif (new.owner_id is distinct from old.owner_id or new.owner_email is distinct from old.owner_email)
        and not public.is_admin() then
    new.owner_id    := old.owner_id;
    new.owner_email := old.owner_email;
  end if;
  return new;
end;
$$;

drop trigger if exists wr_projects_stamp on public.wr_projects;
create trigger wr_projects_stamp before insert or update on public.wr_projects
  for each row execute function public.wr_projects_stamp();

create or replace function public.wr_projects_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wr_activity_log (user_id, email, action, project_id)
  values (auth.uid(), public.my_email(),
          case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'edit' else 'delete' end,
          coalesce(new.id, old.id));
  return null;
end;
$$;

drop trigger if exists wr_projects_log on public.wr_projects;
create trigger wr_projects_log after insert or update or delete on public.wr_projects
  for each row execute function public.wr_projects_log();

create or replace function public.wr_shares_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  new.created_by := public.my_email();
  insert into public.wr_activity_log (user_id, email, action, project_id)
  values (auth.uid(), public.my_email(), 'share', new.project_id);
  return new;
end;
$$;

drop trigger if exists wr_shares_stamp on public.wr_project_shares;
create trigger wr_shares_stamp before insert or update on public.wr_project_shares
  for each row execute function public.wr_shares_stamp();

-- ============================================================ functions the app calls
-- On each sign-in: stamp last_seen and log it.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
  insert into public.wr_activity_log (user_id, email, action) values (auth.uid(), public.my_email(), 'signin');
$$;
grant execute on function public.touch_last_seen() to authenticated;

create or replace function public.set_user_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'only an admin may change roles'; end if;
  if new_role not in ('admin', 'manager', 'user') then raise exception 'unknown role: %', new_role; end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'you cannot remove your own admin role';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- The admin's usage view: one row per person.
drop function if exists public.admin_usage();
create or replace function public.admin_usage()
returns table (id uuid, email text, display_name text, role text, created_at timestamptz,
               last_seen_at timestamptz, projects_owned bigint, signins_30d bigint, edits_30d bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'only an admin may view usage'; end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.created_at, p.last_seen_at,
           (select count(*) from public.wr_projects pr where pr.owner_id = p.id),
           (select count(*) from public.wr_activity_log a where a.user_id = p.id and a.action = 'signin'
              and a.at > now() - interval '30 days'),
           (select count(*) from public.wr_activity_log a where a.user_id = p.id
              and a.action in ('create', 'edit', 'delete', 'share') and a.at > now() - interval '30 days')
    from public.profiles p
    order by p.last_seen_at desc;
end;
$$;
grant execute on function public.admin_usage() to authenticated;

-- Make PostgREST pick up the new tables immediately.
notify pgrst, 'reload schema';
